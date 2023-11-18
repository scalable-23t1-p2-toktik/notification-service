import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import cors from "cors";
import Redis from "ioredis";
import { error } from "console";
import { channel } from "diagnostics_channel";
import axios from "axios";

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
      console.log(`${username} has connected ${socket.id}`);

      const subscriber = client.duplicate();
      subscriber.on("error", (err) => console.error(err));

      try {
        await subscriber.connect();
        await subscriber.subscribe(
          username + "-notification",
          listener(username)
        );

        try {
          await axios.get(
            `http://localhost:8080/getUnReadNotification/${username}`
          );
          console.log("Getting unread notifications");
        } catch (error) {
          console.error(error);
        }
      } catch (error) {
        console.error(error);
      }
    }
  });

  socket.on("disconnect", () => {
    const user = getUserFromId(socket.id);
    if (user.username !== null) {
      redis.unsubscribe(user.username + "-notification");
    }
    console.log(socket.id + " is disconnecting");
    removeUser(socket.id);
  });
});

httpServer.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});

async function processAllNotifications(message, channel) {
  try {
    console.log(`Received message from ${channel}: ${message}`);
    const notificationMessage = JSON.parse(message);

    const username = channel.split("-")[0];

    const reciever = getUser(username);

    io.to(reciever.socketId).emit("notification", notificationMessage);
  } catch (error) {
    console.error("Error processing messages:", error);
  }
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
