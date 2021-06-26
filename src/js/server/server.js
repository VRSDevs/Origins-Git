//////////////////////////////////////////////////////////////////////
//                  Importaciones de otros JS                       //
//////////////////////////////////////////////////////////////////////
import { user } from "./user.js";
import { players } from "../cats.js";
import { darkMatter } from "../darkmatter.js";
import { controller } from "../gameController.js";

//////////////////////////////////////////////////////////////////////
//                        Variables globales                        //
//////////////////////////////////////////////////////////////////////
//******************* IP ************************//
var ip = 'ws://127.0.0.1:80';

//////////////////////////////////////////////////////////////////////
//                         Clase servidor                           //
//////////////////////////////////////////////////////////////////////
class ServerClass {
    //******************* Constructor clase ************************//
    constructor(msgPM, numUs, lCU, servCon, mDB, roomMsg, ws) {
        this.logPlayMenu = msgPM;
        this.connectedUsers = numUs;
        this.listConnectedUsers = lCU;
        this.serverConnected = servCon;
        this.messagesFromDB = mDB;
        this.roomStatus = roomMsg;
        this.connections = ws;
    }

    //******************* Getters ************************//
    getLogPlayMenu() {
        return this.logPlayMenu;
    }
    getListConnectedUsers() {
        return this.listConnectedUsers;
    }
    getConnectedUsers() {
        return this.connectedUsers;
    }
    isServerConnected() {
        return this.serverConnected;
    }
    getMessagesFromDB() {
        return this.messagesFromDB;
    }
    getRoomStatusMessage() {
        return this.roomStatus;
    }
    getWSConnection() {
        return this.connections;
    }

    //******************* Setters ************************//
    setLogMessage(message) {
        this.logMessage = message;
    }
    setLogPlayMenu(message) {
        this.logPlayMenu = message;
    }
    setListConnectedUsers(list){
        this.listConnectedUsers = list;
    }
    setConnectedUsers(value) {
        this.connectedUsers = value;
    }
    setServerConnected(value) {
        this.serverConnected = value;
    }
    setMessagesFromDB(array) {
        this.messagesFromDB = array;
    }
    setRoomStatusMessage(msg) {
        this.roomStatus = msg;
    }
    setWSConnection(connections) {
        this.connections = connections;
    }

    //******************* Otros ************************//
    // Conexiones a servicios generales //
    /**
     * Conexión del cliente al servicio del chat
     */
    connectToChatService() {
        var chatWS = new WebSocket(ip + '/chat');

        chatWS.onopen = function() {
            server.setServerConnected(true);

            var aux = server.getWSConnection();
            aux["chat"] = chatWS;
            server.setWSConnection(aux);
        }

        chatWS.onmessage = function (msg) {
            var message = JSON.parse(msg.data);

            var aux = [];
            aux = server.getMessagesFromDB();

            var messageToAdd = "<" + message.name + "> " + message.message;
            console.log(messageToAdd);

            aux.push(messageToAdd);
            server.setMessagesFromDB(aux);
        }

        chatWS.onerror = function(e) {
            console.log("a");
            server.setServerConnected(false);

            var aux = [];
            var messageToAdd = "<" + message.username + "> " + message.body;

            aux.push(messageToAdd);
            server.setMessagesFromDB(aux);
            /*
            server.setLogMessage("<> Cant establish connection to the server.");
            server.setLogPlayMenu("<> Cant establish connection to the server.");
            */
        }
    }

    /**
     * Conexión del cliente al servicio de usuarios
     */
    connectToUserService() {
        var userWS = new WebSocket(ip + '/user');

        userWS.onopen = function() {
            server.setServerConnected(true);

            var aux = server.getWSConnection();
            aux["user"] = userWS;
            server.setWSConnection(aux);
        }

        userWS.onmessage = function(msg) {
            var message = JSON.parse(msg.data);

            server.setConnectedUsers(message.connectedUsers);
        }
    }

    // Desconexión de servicios generales //
    /**
     * Método para desconectar al usuario de los servicios generales (chat y usuarios)
     */
    disconnect() {
        var arrayConnections = [
            this.getWSConnection()["chat"],
            this.getWSConnection()["user"]
        ];

        arrayConnections.forEach(connection => {
            connection.close();
        });
        
        this.setWSConnection({});
        this.setServerConnected(false);
    }

    // Conexión a salas de online //
    /**
     * Conexión a la sala de tierra
     */
    connectToGroundRoom() {
        var groundRWS = new WebSocket(ip + '/groundR');

        //
        groundRWS.onopen = function() {
            var aux = server.getWSConnection();
            aux["ground"] = groundRWS;
            server.setWSConnection(aux);
        }

        //
        groundRWS.onmessage = function(msg) {
            // Parser del mensaje enviado por parte del servidor
            var message = JSON.parse(msg.data);

            // Comprobación del código del mensaje
            switch (message.code) {
                // Caso: Error_MAXUSERS -> Se ha excedido el número máximo de usuarios de la sala
                case "Error_MAXUSERS":
                    server.setRoomStatusMessage("No se pudo conectar. Sala llena.");
                    break;
                // Caso: OK_ROOMCONN -> Se ha podido establecer la conexión con la sala
                case "OK_ROOMCONN":
                    server.setRoomStatusMessage("Se estableció conexión con la sala");
                    // Actualización de información del usuario
                    user.setOnlineRoom("ground");       // Sala en la que se encuentra
                    user.setIdInRoom(message.userID);   // ID del usuario en la sala
                    console.log(user.getIdInRoom());
                    break;
                // Caso: OK_PLAYERJOIN / OK_GETPLAYERS -> Caso para cuando un jugador entra a la sala y pide información de todos los jugadores
                case "OK_PLAYERJOIN":
                case "OK_GETPLAYERS":
                    players[message.playerId].setType(message.playerType);
                    players[message.playerId].setName(message.playerName);
                    players[message.playerId].setReady(message.playerReady);
                    break;
                // Caso: OK_PLAYERDISC -> Caso para cuando un jugador se desconecta de la sala
                case "OK_PLAYERDISC":
                    players[message.playerId].reset(true);
                    break;
                // Caso: OK_PLAYERREADY -> Un jugador ha marcado que está listo para jugar la partida
                case "OK_PLAYERREADY":
                    players[message.playerId].setReady(message.playerReady);
                    break;
                // Caso: OK_STARTMATCH -> La partida ha comenzado
                case "OK_STARTMATCH":
                    server.connectToGroundMatch();
                    controller.setMatchPlayers(message.players);
                    break;
            }
        }

        //
        groundRWS.onclose = function() {
        }
    }

    /**
     * Método para enviar un mensaje al servicio de la sala
     * @param {WebSocket} wsConnection Conexión websocket de la sala
     * @param {Object} msg Mensaje a enviar al servidor
     */
    messageToRoomService(wsConnection, msg) {
        wsConnection.send(JSON.stringify(msg));
    }

    /**
     * Método para desconectar al cliente de la conexión websocket
     */
    disconnectFromRoom() {
        // Obtención de la conexión del diccionario de conexiones (en función de la sala conectada del usuario)
        var roomConnection;
        switch (user.getOnlineRoom()) {
            // Cada caso es la clave de cada conexión en el diccionario
            case "ground":
                roomConnection = this.getWSConnection()["ground"];
                break;
            default:
                break;
        }

        // Eliminación de la conexión en el diccionario
        this.getWSConnection()["ground"] = null;

        // Reset de las variables del jugador
        players[user.getIdInRoom()].reset(true);

        // Eliminación de la sala e ID del usuario
        user.setOnlineRoom("");
        user.setIdInRoom(-1);

        // Cierre de la conexión
        roomConnection.close();
    }

    /**
     * 
     */
    connectToGroundMatch() {
        var groundMWS = new WebSocket(ip + '/groundM');

        groundMWS.onopen = function() {
            var aux = server.getWSConnection();
            aux["groundMatch"] = groundMWS;
            server.setWSConnection(aux);

            console.log("Partida iniciada.");
        }

        groundMWS.onmessage = function(msg) {
            //
            var message = JSON.parse(msg.data);

            //
            switch (message.code) {
                //
                case "OK_INITIALSTATE":
                    //
                    controller.setMatterPosX(message.matterX);
                    controller.setMatterPosY(message.matterY);
                    break;
                case "OK_PLAYERINFO":
                    //
                    switch (message.updateKey) {
                        case "W":
                            players[message.userId].getObject().setVelocityY(-160);
                            players[message.userId].getObject().setVelocityX(0);
                            players[message.userId].getObject().anims.play(('upP' + message.userId), true);
                            break;
                        case "WM":
                            players[message.userId].getObject().setVelocityY(-160);
                            players[message.userId].getObject().setVelocityX(0);
                            players[message.userId].getObject().anims.play(('upP' + message.userId + 'Matter'), true);
                            break;
                        case "A":
                            players[message.userId].getObject().setVelocityX(-160);
                            players[message.userId].getObject().setVelocityY(0);
                            players[message.userId].getObject().anims.play(('leftP' + message.userId), true);
                            break;
                        case "AM":
                            players[message.userId].getObject().setVelocityX(-160);
                            players[message.userId].getObject().setVelocityY(0);
                            players[message.userId].getObject().anims.play(('leftP' + message.userId + 'Matter'), true);
                            break;
                        case "S":
                            players[message.userId].getObject().setVelocityY(160);
                            players[message.userId].getObject().setVelocityX(0);
                            players[message.userId].getObject().anims.play(('downP' + message.userId), true);
                            break;
                        case "SM":
                            players[message.userId].getObject().setVelocityY(160);
                            players[message.userId].getObject().setVelocityX(0);
                            players[message.userId].getObject().anims.play(('downP' + message.userId + 'Matter'), true);
                            break;
                        case "D":
                            players[message.userId].getObject().setVelocityX(160);
                            players[message.userId].getObject().setVelocityY(0);
                            players[message.userId].getObject().anims.play(('rightP' + message.userId), true);
                            break;
                        case "DM":
                            players[message.userId].getObject().setVelocityX(160);
                            players[message.userId].getObject().setVelocityY(0);
                            players[message.userId].getObject().anims.play(('rightP' + message.userId + 'Matter'), true);
                            break;
                        case "N":
                            players[message.userId].getObject().setVelocityX(0);
                            players[message.userId].getObject().setVelocityY(0);
                            players[message.userId].getObject().anims.play(('idleP' + message.userId), true);
                            break;
                        case "NM":
                            players[message.userId].getObject().setVelocityX(0);
                            players[message.userId].getObject().setVelocityY(0);
                            players[message.userId].getObject().anims.play(('idleP' + message.userId + 'Matter'), true);
                            break;
                        case "V":
                            controller.getmusicEffect1().play();
                            controller.getmusicEffect2().play();

                            players[message.userId].setHasMatter(true);
                            players[message.userVictim].setHasMatter(false);

                            players[message.userId].getObject().anims.play(('idleP' + message.userId + 'Matter'), true);
                            players[message.userVictim].getObject().anims.play(('idleP' + message.userId), true);
                            break;
                    }

                        //Normalizar vectores
                        if(players[message.userId].getSand() == true){
                            players[message.userId].getObject().body.velocity.normalize().scale(80);
                        } else {
                            players[message.userId].getObject().body.velocity.normalize().scale(160);
                        }

                        break;
                case "OK_POINTSINFO":
                    players[message.userId].setScore(players[message.userId].getScore() + 1);       
                    break;
                case "OK_TAKEDM":
                    darkMatter.getObject().disableBody(true, true);
                    players[message.userTaken].setHasMatter(true);
                    controller.getmusicEffect1().play();
                    break;
            }
        }
    }
}

//////////////////////////////////////////////////////////////////////
//                       Inicialización de datos                    //
//////////////////////////////////////////////////////////////////////
var server = new ServerClass("", 0, [], false, [], "", {});

//////////////////////////////////////////////////////////////////////
//                            Exportación                           //
//////////////////////////////////////////////////////////////////////
export { server };