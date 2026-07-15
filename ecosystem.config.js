// Configuração do PM2 para rodar o Next.js diretamente no VPS (sem Docker).
// Uso: pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: "rute-lanches",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      // Reinicia sozinho se cair, mas não fica em loop de crash infinito.
      max_restarts: 10,
      min_uptime: "15s",
      restart_delay: 3000,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      out_file: "logs/pm2-out.log",
      error_file: "logs/pm2-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
