FROM envoyproxy/envoy-dev:e6e3a0c7a0e4777bd24b25d1b970f448c780c0cc

COPY test.yaml /etc/envoy/envoy.yaml

EXPOSE 80

CMD ["envoy", "-c", "/etc/envoy/envoy.yaml"]