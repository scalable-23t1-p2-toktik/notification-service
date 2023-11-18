import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import cors from "cors";
import Redis from "ioredis";
import { error } from "console";
import { channel } from "diagnostics_channel";

const httpServer = createServer();
const redis = new Redis({
  host: "localhost",
  port: 6379,
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

const client = createClient();
client.on("error", (err) => console.log("Redis Client Error", err));
await client.connect();

let onlineUsers = [];

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const listener = (username) => async (message, channel) => {
  console.log("channel: " + channel);
  console.log("message: " + message);
  console.log("username: " + username);
  if (message && channel) {
    processAllNotifications(message, channel);
  }
};

io.on("connection", (socket) => {
  socket.on("newUser", async (username) => {
    if (username !== null) {
      addNewUser(username, socket.id);
      console.log(`${username} has connected`);
      const subscriber = client.duplicate();
      subscriber.on("error", (err) => console.error(err));
      await subscriber.connect();
      await subscriber.subscribe(
        username + "-notification",
        listener(username)
      );
    }
  });

  socket.on("disconnect", () => {
    // const username = getUserFromId(socket.socketId);
    //TODO: unsubscribe

    // redis.unsubscribe(username + "-notification");
    removeUser(socket.socketId);
  });
});

httpServer.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});

async function processAllNotifications(message, channel) {
  try {
    // const listName = user.username + "-notification";
    // const message = await redis.lpop(listName);
    console.log(`Received message from ${channel}: ${message}`);
    const notificationMessage = JSON.parse(message);

    const username = channel.split("-")[0];
    // const parts = message.split(":");
    // const type = notificationMessage["type"];
    // const message = notificationMessage["text"];

    const reciever = getUser(username);

    io.to(reciever.socketId).emit("notification", notificationMessage);

    // switch (type) {
    //   case "like":
    //     likeNotification(
    //       io.to(socketId),
    //       username,
    //       notificationMessage[""],
    //       parts[2]
    //     );
    //     break;
    //   case "comment":
    //     commentNotification(
    //       io.to(socketId),
    //       username,
    //       parts[1],
    //       parts[2],
    //       parts[3]
    //     );
    //     break;
    //   default:
    //     break;
    // }
  } catch (error) {
    console.error("Error processing messages:", error);
  }
}

function sendNotification(socket, reciever, text) {
  socket.to(reciever.socketId).emit("notification", text);
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

const getUserFromId = (socketId) => {
  return onlineUsers.find((user) => user.socketId === socketId);
};
