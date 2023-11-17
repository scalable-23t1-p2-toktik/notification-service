import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import cors from "cors";
import Redis from "ioredis";
import { error } from "console";
import { randomUUID } from "crypto";

const httpServer = createServer();
const redis = new Redis({
  host: "localhost",
  port: 6379,
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

let onlineUsers = [];

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("newUser", (username) => {
    if (username !== null) {
      addNewUser(username, socket.id);
      console.log(`${username} has connected`);
      processAllNotifications();
    }
  });

  // onlineUsers.push({ username: name, socketId: socket.userID });

  // onlineUsers.forEach((user) => {
  //   console.log(user.username + " is connected");
  //   console.log("socket id: " + user.socketId);
  //   processNotification(socket, user.username, user.socketId).catch(error);
  // });

  // const listName = username + "-notification";
  // console.log(listName);

  // if (listName != null) {
  //   // listNotification(socket, listName);
  //   processNotification(socket, listName).catch(console.error);
  // }

  socket.on("disconnect", () => {
    removeUser(socket.socketId);

    // redis.close();
  });
});

httpServer.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});

async function processAllNotifications() {
  try {
    while (true) {
      for (const user of onlineUsers) {
        const listName = user.username + "-notification";
        const [list, message] = await redis.lpop(listName, 0);
        console.log(`Received message from ${list}: ${message}`);
        const parts = message.split(":");
        const type = parts[0];

        switch (type) {
          case "like":
            likeNotification(
              io.to(user.socketId),
              user.username,
              parts[1],
              parts[2]
            );
            break;
          case "comment":
            commentNotification(
              io.to(user.socketId),
              user.username,
              parts[1],
              parts[2],
              parts[3]
            );
            break;
          default:
            break;
        }
      }
    }
  } catch (error) {
    console.error("Error processing messages:", error);
  }
}

function likeNotification(socket, vip, username, videoName) {
  const reciever = getUser(vip);
  const likeMessage = `${username} has liked ${videoName}`;
  console.log(likeMessage);
  socket.to(reciever.socketId).emit("notification", likeMessage);
}

function commentNotification(socket, vip, username, text, videoName) {
  // const commentMessage = `${userId} has commented: ${text} in ${videoName}`;
  const reciever = getUser(vip);
  const commentMessage =
    username + " has commented: " + text + ", in " + videoName;
  console.log(commentMessage);
  socket.to(reciever.socketId).emit("notification", commentMessage);
}

const addNewUser = (username, socketId) => {
  !onlineUsers.some((user) => user.username === username) &&
    onlineUsers.push({ username, socketId });
};

const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
};

const getUser = (username) => {
  return onlineUsers.find((user) => user.username === username);
};
