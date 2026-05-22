# Build stage
FROM gradle:8.7-jdk21 AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src
RUN gradle installDist --no-daemon

# Run stage
FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y unrar unzip p7zip-full && rm -rf /var/lib/apt/lists/*
RUN mkdir /app
COPY --from=build /home/gradle/src/build/install/polarnight-backend /app/
WORKDIR /app

# Ensure data directory exists
RUN mkdir -p /app/data/thumbnails
RUN mkdir -p /app/manga

EXPOSE 8080

CMD ["./bin/polarnight-backend"]
