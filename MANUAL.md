# Användarmanual

Den här manualen är tänkt för daglig användning av appen. För tekniska detaljer, se [README.md](/c:/Users/eripet/Coding/Hyllsystem/README.md).

Aktuell version: `v1.3.0`

## Tanken med systemet

Varje fysisk låda har en egen identitet, och varje gång innehållet uppdateras skapas en ny inventering för samma låda.

Det betyder att du kan:

- flytta en låda utan att tappa historik
- lägga till fler bilder senare
- byta innehåll i lådan och ändå behålla samma låda

En låda kan nu stå på flera typer av platser:

- i en `Ivar`
- på eller under en `Bänk`
- i ett `Skåp`

## Vanligt arbetsflöde

1. Fota lådan med mobilen.
2. Låt bilderna synka till Immich.
3. Öppna `Bilder att koppla`.
4. Markera de bilder som hör till samma låda.
5. Klicka på `Analysera markerade bilder`.
6. Kontrollera AI-förslaget.
7. Klicka på `Koppla låda` eller gå vidare till `Ny låda / inventering`.
8. Justera text, bildroller och analystext vid behov.
9. Spara sessionen.

Efter sparning går appen tillbaka till översikten.

## Bra bildtyper att ta

Appen fungerar bäst när varje låda har minst:

- en tydlig etikettbild
- en eller flera bilder på innehållet

Bra extra bilder är:

- utplockat innehåll på bord
- detaljbilder på småprylar
- platsbild om etiketten är svår att läsa

## Bildroller

Rollerna i appen betyder:

- `Etikett`: etiketten eller platslappen är huvudmotivet
- `Plats`: bilden visar var lådan står
- `Inuti`: lådans innehåll i lådan
- `Utplockat`: innehållet är utlagt utanför lådan
- `Detalj`: närbild på en viss pryl eller del

Om AI:n väljer fel roll kan du ändra den manuellt.

## Översikt

På startsidan kan du:

- söka efter saker i verkstan
- använda röstsökning
- öppna `Översiktsbild` i egen lightbox
- öppna en låda genom att klicka på lådkortet
- klicka på bilder för att se dem i lightbox
- hovra på bilder med analystext för att läsa en snabb beskrivning direkt
- se hur många aktuella platser som finns i systemet

`Översiktsbild` hämtas automatiskt från albumomslaget i valt Immich-album.

Lådorna visas i fysisk ordning i översikten:

- först `Ivar`
- sedan `Bänk`
- sist `Skåp`

Sökningen hittar inte bara lådnamn, utan även:

- sammanfattningar
- sökord
- bildspecifika analystexter

## Lagerplats

Sidan `Lagerplats` visar alla platsenheter, till exempel:

- `Ivar C`
- `Bänk Svarv`
- `Skåp 3D-print`

Här kan du:

- klicka dig in på rätt platsenhet
- se lådor grupperade per hylla eller yta
- öppna en låda direkt från platsvyn

I `Ivar`-vyn visas bara de platser som faktiskt används på respektive hylla. Om en hylla har 2 platser visas 2, och om en annan har 4 så visas 4 där.

Det här är särskilt bra när du vill hitta något utifrån hur verkstaden faktiskt ser ut, snarare än genom fritextsökning.

## Bilder att koppla

Den här sidan visar bara bilder som ännu inte är kopplade till någon låda.

Albumomslaget i Immich visas inte här, eftersom det används som översiktsbild på startsidan.

Här kan du:

- markera flera bilder
- låta AI föreslå låda och plats
- se sannolika befintliga lådor
- koppla direkt till ett bra förslag

Om flera små lådor står på samma plats försöker appen välja nästa lediga variant, till exempel `A`, `B` eller `C`.

## Ny låda / inventering

Här gör du själva registreringen.

Du kan:

- justera lådnamn
- välja platskategori: `Ivar`, `Bänk` eller `Skåp`
- välja eller ändra aktuell plats
- välja plats innan du skriver lådnamnet
- skriva noteringar och spara sessionen direkt efter `Sökord`
- ändra bildordning
- ändra bildroller
- analysera enskilda bilder
- redigera analystexten manuellt
- låta markerade album-bilder följa med automatiskt när du sparar, även om du inte först trycker på `Lägg till valda bilder`

Om du försöker skapa en ny låda på en plats som redan är upptagen stoppas sparningen. Då ska du i stället:

- välja en annan bokstav
- eller öppna och redigera den befintliga lådan

För en befintlig låda kan du använda `Ändra plats` om lådan flyttats i verkstaden.

Det är ofta den bästa sidan att använda när AI:n nästan har rätt men behöver lite hjälp.

## Låd-vyn

Här ser du den färdiga lådan.

Du kan:

- se aktuell sammanfattning
- öppna alla bilder
- analysera enstaka bilder i efterhand
- redigera analystext
- lägga till fler bilder
- släppa en felkopplad bild
- öppna historik

Om en bild har analystext kan du också se den direkt som tooltip när du hovrar på bilden i olika delar av appen.

Historiken finns kvar även om lådan flyttas till en ny plats.

## När AI:n inte blir rätt

Det är helt normalt att AI:n ibland behöver hjälp.

Det enklaste är då att:

1. rätta bildrollerna
2. rätta lådnamnet
3. rätta analystexten
4. spara

Bra att tänka på:

- etikettbilden bör vara tydlig och nära
- 2 till 6 bilder brukar ge bäst översiktsanalys
- för många bilder samtidigt kan göra analysen långsammare eller sämre

Sökningen är också mer tolerant än tidigare, så den kan ofta förstå både:

- `rc-bil`
- `cr-bil`
- `radiostyrd`

som samma typ av låda eller innehåll.

## Inställningar

På sidan `Inställningar` kan du ändra:

- tema
- typsnitt
- textstorlek
- Immich-konto och album
- AI-provider och modell
- promptar som styr modellen
- rensningsfraser och andra filter som städar AI-svar
- ladda ner backup
- exportera katalogen till Excel
- importera katalog från en exporterad Excel-fil

Det här är särskilt användbart om du testar olika modeller i LM Studio.

## Om något ser konstigt ut

Några vanliga situationer:

- En bild saknas:
  den kan ha tagits bort i Immich. Appen ska ändå fortsätta fungera.

- En analys känns tom eller märklig:
  prova igen, eller skriv en egen analystext manuellt.

- Fel låda föreslås:
  kontrollera etikettbilden och välj rätt låda manuellt.

- En bild hamnade i fel låda:
  använd `Släpp bild` från lådvyn.

- En låda står på fel plats:
  öppna lådan eller registreringssidan och använd `Ändra plats`.

## Rekommenderat arbetssätt i vardagen

- Fota alltid etikett först om möjligt.
- Ta sedan 1 till 3 innehållsbilder.
- Använd `Bilder att koppla` för snabb sortering.
- Gör finjusteringar i `Ny låda / inventering`.
- Använd översikten som din huvudsakliga söksida.
- Använd `Lagerplats` när du vill navigera visuellt mellan Ivar, bänkar och skåp.
