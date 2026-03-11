FROM phusion/baseimage:focal-1.0.0

RUN apt-get update
RUN apt-get -yq install net-tools iproute2 ethtool

# socat 설치: netem이 서버의 프록시 역할 수행
RUN apt-get install -y socat 

RUN mkdir -p /etc/my_init.d
COPY startup.sh /etc/my_init.d/startup.sh
RUN chmod +x /etc/my_init.d/startup.sh
