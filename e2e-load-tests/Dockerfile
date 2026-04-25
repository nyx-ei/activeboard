FROM grafana/k6:latest

# Copy test scripts and config
COPY config.js /scripts/
COPY session-lifecycle.js /scripts/
COPY connection-stability.js /scripts/

WORKDIR /scripts

# Default test scenario
ENV SCENARIO=smoke
ENV BASE_URL=http://host.docker.internal:3000

# Run smoke test by default
CMD ["run", "--vus", "5", "--duration", "60s", "session-lifecycle.js"]
