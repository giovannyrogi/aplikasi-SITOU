module.exports = {
  apps: [
    {
      name: "app-absensi-pm",
      script: "npm",
      args: "start",
      env: {
        HOST: "127.0.0.1",
        PORT: 3000
      }
    }
  ]
}
