# Användarmanual

Den här manualen är tänkt för daglig användning av appen. För tekniska detaljer, se [README.md](/c:/Users/eripet/Coding/Hyllsystem/README.md).

## Tanken med systemet

Varje fysisk låda har en egen identitet, och varje gång innehållet uppdateras skapas en ny inventering för samma låda.

Det betyder att du kan:

- flytta en låda utan att tappa historik
- lägga till fler bilder senare
- byta innehåll i lådan och ändå behålla samma låda

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
- öppna en låda genom att klicka på lådkortet
- klicka på bilder för att se dem i lightbox

Sökningen hittar inte bara lådnamn, utan även:

- sammanfattningar
- sökord
- bildspecifika analystexter

## Bilder att koppla

Den här sidan visar bara bilder som ännu inte är kopplade till någon låda.

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
- se aktuell plats
- ändra bildordning
- ändra bildroller
- analysera enskilda bilder
- redigera analystexten manuellt

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

## Inställningar

På sidan `Inställningar` kan du ändra:

- tema
- typsnitt
- textstorlek
- Immich-konto och album
- AI-provider och modell
- promptar som styr modellen

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

## Rekommenderat arbetssätt i vardagen

- Fota alltid etikett först om möjligt.
- Ta sedan 1 till 3 innehållsbilder.
- Använd `Bilder att koppla` för snabb sortering.
- Gör finjusteringar i `Ny låda / inventering`.
- Använd översikten som din huvudsakliga söksida.
