FROM rclone/rclone:latest
RUN apk add --no-cache bash tzdata coreutils findutils
WORKDIR /work
COPY backup.sh /work/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /work/backup.sh
CMD ["crond", "-f", "-l", "8"]
