# DYMO via CUPS

Det här projektet använder en `DYMO LabelWriter 5XL` via `CUPS` på Ubuntu-servern.

## Aktuell serverkonfiguration

- server: `10.0.0.33`
- skrivare: `DYMO LabelWriter 5XL`
- skrivare-IP: `10.0.0.76`
- protokoll: `RAW socket 9100`
- CUPS-kö: `DYMO_5XL`
- device URI: `socket://10.0.0.76:9100`
- PPD: `/usr/share/cups/model/lw5xl.ppd`
- filter: `/usr/lib/cups/filter/raster2dymolw_v2`

## Installerade beroenden

- `cups`
- `libcups2-dev`
- `libcupsimage2-dev`
- `build-essential`
- `autoconf`
- `automake`
- `libtool`
- `libboost-dev`

## Drivrutinskälla

Officiell DYMO-källa:

- `https://github.com/dymosoftware/Drivers`

Paket som användes:

- `LW5xx_Linux`

## Installationsnotering

Drivrutinen byggdes från källa på Ubuntu 24.04.

För att få bygget att fungera med modern toolchain behövdes:

1. `autoreconf -fi`
2. en liten kompatibilitetspatch i `LabelManagerLanguageMonitorV2.cpp`
   Där lades `#include <ctime>` till innan `make`.

LabelWriter-delen för `5XL` installerades sedan korrekt i CUPS.

## CUPS-kö

Kön skapades i princip med:

```bash
sudo lpadmin -p DYMO_5XL -E \
  -v socket://10.0.0.76:9100 \
  -P /usr/share/cups/model/lw5xl.ppd

sudo cupsenable DYMO_5XL
sudo cupsaccept DYMO_5XL
```

## Test

Kommunikationen verifierades på två nivåer:

- servern kunde nå skrivaren på `10.0.0.76:9100`
- CUPS-loggen visade att ett DYMO-jobb skickades och slutfördes

Exempel på enkel testutskrift:

```bash
cat > /tmp/dymo-test.txt <<'EOF'
Hyllsystem test
Ivar: C  Hylla: 3  Plats: 1A
DYMO LabelWriter 5XL via CUPS
EOF

lp -d DYMO_5XL -o media=30334_2-1_4_in_x_1-1_4_in /tmp/dymo-test.txt
```

## Nästa steg i appen

Nästa logiska steg är att koppla etikettgeneratorn på `/labels` till en riktig serverendpoint, till exempel:

- `POST /api/labels/print`

Den endpointen kan då:

1. rendera etikettinnehåll
2. generera utskriftsbar fil eller PDF
3. skicka jobbet till `DYMO_5XL` via `lp`
