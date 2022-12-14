#!/bin/sh
if [ -n "$VISUAL" ]; then
  echo $VISUAL 
elif [ -n "$EDITOR" ]; then
  echo $EDITOR 
elif type sensible-editor >/dev/null 2>/dev/null; then
  echo sensible-editor 
elif cmd=$(xdg-mime query default ) 2>/dev/null; [ -n "$cmd" ]; then
  echo "$cmd" 
else
  editors='nano joe vi'
  if [ -n "$DISPLAY" ]; then
    editors="gedit kate $editors"
  fi
  for x in $editors; do
    if type "$x" >/dev/null 2>/dev/null; then
      echo "$x" 
    fi
  done
fi
