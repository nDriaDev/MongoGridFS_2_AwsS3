# ARTS DEI UDA IMAGES UPLOADER
L'applicazione ha la scopo di prelevare le immagini delle uda di arts dei che corrispondono ai filtri passati dall'utente, e di caricarle su un bucket aws s3.

## Struttura dati immagini
Sul db mongo le immagini sono state caricate utilizzando il GridFS. Le collection in oggetto sono:
- UdaArtsDei
- UdaPhoto.chunks
- UdaPhoto.files

La collection _UdaArtsDei_ contiene i dati relativi alle uda. Questi documenti sono filtrati tramite l'input dell'utente. Di ogni documento è necessario ricavare i campi:
- __idUda__: campo stringa
- __documentiDaCaricare__: array di un oggetto con all'interno i campi:
    - ___nomeFile___: campo stringa
    - ___mimeType___: campo stringa
Concatenanto il campo idUda e documentiDaCaricare[0].nomeFile si risale al documento corrispondente alla foto dell'uda che si trova nella collecion _UdaPhoto.files_, tramite il campo __filename__.
La collection _UdaPhoto.chunks_ è ricondotta tramite il suo campo __file_id__ al campo ___id__ della collection _UdaPhoto.files_.

## HOW WORK
E' importante settare tutte le variabili contenute nel file di .env corrispondente all'ambiente che si vuole utilizzare.
Dopo averlo fatto, eseguire la build relativa all'ambiente scelto e visitare http://localhost:<process.env.PORT>/api-docs/ per visualizzare la documentazione swagger dell'applicazione.
