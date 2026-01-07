import env from "./env.js";

function getISTTimestamp() {
  return new Date().toLocaleString("en-IN", {
    timeZone: env.timezone
  });
}

const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({
      level: "INFO",
      time: getISTTimestamp(),
      message,
      ...meta
    }));
  },

  error(message, meta = {}) {
    console.error(JSON.stringify({
      level: "ERROR",
      time: getISTTimestamp(),
      message,
      ...meta
    }));
  }
};

export default logger;
