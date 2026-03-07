#!/bin/bash
source .env

# Restart Docker service and clean up dangling images
docker compose -f docker-compose.local.yml kill
docker compose -f docker-compose.local.yml rm -f
docker compose -f docker-compose.local.yml up
