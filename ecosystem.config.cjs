module.exports = {  // Usa module.exports invece di export default
	apps: [
		{
			name: "dev",
			script: "src/index.ts",
			interpreter: "node",
			interpreter_args: "--import tsx --env-file environment/.env",
			instances: "3",
			exec_mode: "cluster",
			watch: true,
			ignore_watch: ["node_modules", "logs"],
			max_memory_restart: "1G",
			log_date_format: "YYYY-MM-DD HH:mm:ss",
		},
		{
			name: "prod",
			script: "./dist/index.js",
			instances: "3",
			exec_mode: "cluster",
			autorestart: true,
			watch: false,
			node_args: "--env-file environment/.env"
		}
	]
};
