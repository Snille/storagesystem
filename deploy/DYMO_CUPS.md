# DYMO Through CUPS

This project currently uses a `DYMO LabelWriter 5XL` through `CUPS` on the Ubuntu server.

## Current Server Configuration

- server: `10.0.0.33`
- printer: `DYMO LabelWriter 5XL`
- printer IP: `10.0.0.76`
- protocol: `RAW socket 9100`
- CUPS queue: `DYMO_5XL`
- device URI: `socket://10.0.0.76:9100`
- PPD: `/usr/share/cups/model/lw5xl.ppd`
- filter: `/usr/lib/cups/filter/raster2dymolw_v2`

## Installed Dependencies

- `cups`
- `libcups2-dev`
- `libcupsimage2-dev`
- `build-essential`
- `autoconf`
- `automake`
- `libtool`
- `libboost-dev`

## Driver Source

Official DYMO source:

- `https://github.com/dymosoftware/Drivers`

Package used:

- `LW5xx_Linux`

## Installation Notes

The driver was built from source on Ubuntu 24.04.

To make the build work with a modern toolchain, it required:

1. `autoreconf -fi`
2. a small compatibility patch in `LabelManagerLanguageMonitorV2.cpp`
   Add `#include <ctime>` before `make`

The `5XL` LabelWriter part was then installed correctly in CUPS.

## CUPS Queue

The queue was created roughly like this:

```bash
sudo lpadmin -p DYMO_5XL -E \
  -v socket://10.0.0.76:9100 \
  -P /usr/share/cups/model/lw5xl.ppd

sudo cupsenable DYMO_5XL
sudo cupsaccept DYMO_5XL
```

## Testing

Communication was verified on two levels:

- the server could reach the printer at `10.0.0.76:9100`
- the CUPS log showed that a DYMO job was sent and completed

Example of a simple test print:

```bash
cat > /tmp/dymo-test.txt <<'EOF'
Storage System test
Shelving unit: C  Shelf: 3  Slot: 1A
DYMO LabelWriter 5XL via CUPS
EOF

lp -d DYMO_5XL -o media=30334_2-1_4_in_x_1-1_4_in /tmp/dymo-test.txt
```

## Current App Integration

The DYMO flow is now integrated in the app through:

- `POST /api/labels/print`
- `GET /api/labels/printer-status`

The app currently supports:

- direct label printing through CUPS
- printer status reading on the labels page
- active roll detection
- remaining label count for supported DYMO models
- printer queue selection from already installed CUPS queues in `Settings`

DYMO queues are still the recommended choice in the UI until A4 sheet label support is added for regular laser printers.
