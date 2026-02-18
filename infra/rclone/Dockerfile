FROM alpine:3.19

# Install rclone + cron utilities (busybox crond included by default)
RUN apk add --no-cache bash tzdata coreutils findutils rclone

WORKDIR /work
COPY backup.sh /work/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /work/backup.sh

# busybox crond (foreground, log level 8)
ENTRYPOINT []
CMD ["/usr/sbin/crond", "-f", "-l", "8"]
