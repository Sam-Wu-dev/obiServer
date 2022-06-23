//tcp server
import net from 'net';
import { networkInterfaces } from 'os';
import gson from 'gson';
import { signIn, signUp, getUsers, messaging, getChatRoom, getFriend } from './firebase.js';
const nets = networkInterfaces();
const ip = Object.create(null); // Or just '{}', an empty object

for (const name of Object.keys(nets)) {
    // get IP of this device
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
        if (net.family === familyV4Value && !net.internal) {
            if (!ip[name]) {
                ip[name] = [];
            }
            ip[name].push(net.address);
        }
    }
}

let onlineUsers = new Set();
let table = new Map();

function getFromClient(socket, data) {
    console.log("This data: " + data);
    try {
        const json = JSON.parse(data);
        if (json.type === "signIn") {
            console.log("signing");
            let userInfo = json.message;
            signIn(userInfo.email, userInfo.password).then(user => {
                if (user) {
                    sendToClient(socket, "signIn", {
                        success: true,
                        user: user
                    });
                    console.log("success to sign in ", user.name);
                    onlineUsers.add(user.userId);
                    table.set(user.userId, socket);
                } else {
                    sendToClient(socket, "signIn", {
                        success: false
                    });
                    console.log("fail to sign in");
                }
            });
        } else if (json.type === "signUp") {
            signUp(json.message).then(res => {
                if (res) {
                    sendToClient(socket, "signUp", {
                        success: true,
                        userId: res
                    });
                    console.log("success to sign up");
                } else {
                    sendToClient(socket, "signUp", {
                        success: false
                    });
                    console.log("fail to sign up");
                }
            });
        } else if (json.type === "getUsers") {
            getUsers(json.message.email).then(res => {
                if (res) {
                    sendToClient(socket, "getUsers", {
                        success: true,
                        users: res
                    });
                    console.log("success to get users");
                    for (let i = 0; i < res.length; i++) {
                        console.log(res[i].name);
                    }
                } else {
                    sendToClient(socket, "getUsers", {
                        success: false
                    });
                    console.log("fail to get users");
                }
            });
        } else if (json.type === "messaging") {
            messaging(json.message.aId, json.message.bId, json.message.message, json.message.timestamp).then(res => {
                sendToClient(socket, "newMessage", {
                    success: true,
                    sender: json.message.aId,
                    receiver: json.message.bId,
                    message: json.message.message,
                    timestamp: json.message.timestamp
                });
                console.log("friendId", json.message.bId);
                console.log("timestamp", json.message.timestamp);
                console.log("success to messaging");
                if (onlineUsers.has(json.message.bId)) {
                    sendToClient(table.get(json.message.bId), "newMessage", {
                        success: true,
                        sender: json.message.aId,
                        receiver: json.message.bId,
                        message: json.message.message,
                        timestamp: json.message.timestamp
                    });
                    console.log("success to messaging to the other user");
                }
            });
        } else if (json.type === "getChatRoom") {
            getChatRoom(json.message.aId, json.message.bId).then(res => {
                let obj = {
                    success: true,
                    A: res.A,
                    B: res.B,
                    aImage: res.aImage,
                    bImage: res.bImage,
                    aName: res.aName,
                    bName: res.bName,
                    messages: res.messages
                }
                if (res.isNew && onlineUsers.has(json.message.bId)) {
                    sendToClient(table.get(json.message.bId), "getChatRoom", obj);
                    console.log("success to getChatRoom to the other user");
                }
                sendToClient(socket, "getChatRoom", obj);
                console.log("success to getChatRoom");
            });
        } else if (json.type === "getFriend") {
            console.log("getting friends");
            getFriend(json.message.userId).then(res => {
                if (res) {
                    sendToClient(socket, "getFriend", {
                        success: true,
                        friends: res
                    });
                    console.log("success to get friends");
                }
            }).catch(err => {
                sendToClient(socket, "getFriend", {
                    success: false
                });
                console.log("fail to get friends");
            });
        } else {
            console.log("unknown type");
        }
    } catch (e) {
        console.log("Error: " + data + " End of Error.");
        console.log(e);
        return;
    }
}


function sendToClient(socket, type, json) {
    json["type"] = type;
    socket.write(JSON.stringify(json) + '\n');
}

var server = net.createServer(function(socket) {
    let buffer = "";
    socket.on('data', function(chunk) {
        let str = chunk.toString();
        console.log("change line detected at ", chunk.toString().indexOf('\n'));
        console.log("length of this chunk is ", chunk.toString().length);
        if (!str.includes('\n')) {
            buffer += str;
            return;
        }
        while (str.indexOf('\n') != -1) {
            buffer += str.substring(0, str.indexOf('\n'));
            getFromClient(socket, buffer);
            str = str.substring(str.indexOf('\n') + 1);
            buffer = "";
        }
    });
    socket.on('end', function() {
        onlineUsers.delete(socket);
        console.log('disconnected');
    });
}).listen(1337,
    function(err) {
        if (err) {
            console.log('error');
        } else {
            console.log('listening');
            console.log(ip);
        }
    }
);