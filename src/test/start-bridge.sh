#!/bin/bash

# Default values
HOST="192.168.50.140"
PORT=11123

# Parse command line arguments
while getopts h:p: flag
do
    case "${flag}" in
        h) HOST=${OPTARG};;
        p) PORT=${OPTARG};;
    esac
done

echo "🚀 Starting GPS Bridge Server..."
echo "📱 GPS2IP Host: $HOST"
echo "🔌 GPS2IP Port: $PORT"

# Pass arguments to the Node script
node src/utils/gps-bridge-server.mjs --host "$HOST" --port "$PORT"