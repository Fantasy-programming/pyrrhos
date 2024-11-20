{ pkgs, ... }:

{

  packages = [ 
    pkgs.air
    pkgs.go-migrate
  ];

  languages.go.enable = true;
  
  dotenv = {
    enable = true;
    filename = ".env";
  };

  services.postgres = {
    enable = true;
    initialScript = "CREATE USER pyrrhos SUPERUSER;";
    listen_addresses = "127.0.0.1";
    package = pkgs.postgresql_16;
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
}
