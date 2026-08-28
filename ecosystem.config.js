module.exports = {
  apps: [
    {
      name: "sitou",
      script: "npm",
      args: "start",
      env: {
        HOST: "127.0.0.1",
        PORT: 3003,
      },
    },
  ],
};
