{ pkgs,  ... }:

{
  # https://devenv.sh/packages/
  packages = [ 
    pkgs.git
    pkgs.air
    pkgs.go-migrate
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs-slim_22;
    pnpm.enable = true;
    npm.enable = true;
  };

  languages.go.enable = true;


  services.postgres = {
    enable = true;
    initialScript = "CREATE USER test SUPERUSER;";
    listen_addresses = "127.0.0.1";
    # package = pkgs.postgresql_16;
    initialDatabases = [
      { 
        name = "pyrrhos";
      }
    ];
    settings = {
      log_connections = true;
      log_statement = "all";
    };
  };

  services.clickhouse.enable = true;

  processes = {
    echoip.exec = "docker run -p 3002:8080 --rm --name echoip echoip";
  };

  # https://devenv.sh/pre-commit-hooks/
  # pre-commit.hooks.shellcheck.enable = true;
}
