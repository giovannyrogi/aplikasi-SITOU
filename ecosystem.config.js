module.exports = {
  apps: [
    {
      name: "sitou",
      cwd: __dirname,
      script: "npm",
      args: "start",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3003,
      },
    },
    {
      name: "sitou-file-cleanup-worker",
      cwd: __dirname,
      script: "npm",
      args: "run worker:file-cleanup",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      restart_delay: 5000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
