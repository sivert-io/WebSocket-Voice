#!/bin/bash

# Define the session name
SESSION_NAME="websocket_dev_session"

# Create a new tmux session and run the start.sh command in the first pane
tmux new-session -d -s "$SESSION_NAME" 'cd stfu_go && ./start.sh'

# Split the window into two vertical panes and run the second command in the second pane
tmux split-window -v "cd client && bun dev"

# Split the new pane into two horizontal panes and run the third command in the third pane
tmux split-window -h "cd server && bun dev"

# Attach to the tmux session
tmux attach -t "$SESSION_NAME"