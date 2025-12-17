import { Router } from "express";
import { controllers } from "../../controllers/index.js";

export const apiRoutes = (router: Router) => {
	/**
	* @openapi
	* /api/v1/uda/fields:
	*   get:
	*     summary: Esegue la query per ottenere l'elenco dei campi di un documento della collection UdaArtsDei
	*     tags:
	*       - Mongo
	*     responses:
	*       200:
	*         description: La lista dei campi
	*         content:
	*           application/json:
	*             schema:
	*               type: array
	*               items:
	*                 type: object
	*                 properties:
	*                   id:
	*                     type: string
	*                   type:
	*                     type: string
	*                   mimeType:
	*                     type: string
	*       400:
	*         description: Errore collection empty
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/uda/fields", controllers.apiController.getUdaFields);
	/**
	* @openapi
	* /api/v1/uda/get/{query}:
	*   get:
	*     summary: Esegue la query per la ricerca delle uda di cui prelevare le foto con la query passata come query param
	*     tags:
	*       - Mongo
	*     parameters:
	*       - name: query
	*         in: path
	*         required: true
	*         schema:
	*           type: string
	*     responses:
	*       200:
	*         description: La lista di uda trovate
	*         content:
	*           application/json:
	*             schema:
	*               type: array
	*               items:
	*                 type: object
	*                 properties:
	*                   id:
	*                     type: string
	*                   type:
	*                     type: string
	*                   mimeType:
	*                     type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/uda/get/:query", controllers.apiController.getUdaData);
	/**
	* @openapi
	* /api/v1/upload-photo:
	*   get:
	*     summary: Esegue l'upload delle foto trovate precedentemente con il servizio /uda/:query
	*     tags:
	*       - GridFS
	*     responses:
	*       200:
	*         description: Un messaggio di successo con il tempo impiegato per l'upload.
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       400:
	*         description: Richiesta non valida
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/upload-photo", controllers.apiController.uploadPhoto);
	/**
	* @openapi
	* /api/v1/upload-photo-parallel:
	*   get:
	*     summary: Esegue l'upload delle foto trovate precedentemente con il servizio /uda/:query in parallelo
	*     tags:
	*       - GridFS
	*     responses:
	*       200:
	*         description: Un messaggio di successo con il tempo impiegato per l'upload.
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       400:
	*         description: Richiesta non valida
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/upload-photo-parallel", controllers.apiController.uploadPhotoParallel);
	/**
	* @openapi
	* /api/v1/sse/upload-photo:
	*   get:
	*     summary: Esegue l'upload delle foto trovate precedentemente con il servizio /uda/:query e invia i progressi tramite Server-Sent Events
	*     tags:
	*       - GridFS
	*     responses:
	*       200:
	*         description: Stream di eventi SSE
	*         content:
	*           text/event-stream:
	*             schema:
	*               type: object
	*               properties:
	*                 id:
	*                   type: string
	*                 type:
	*                   type: string
	*                 mimeType:
	*                   type: string
	*       400:
	*         description: Richiesta non valida
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/sse/upload-photo", controllers.apiController.sseUploadPhoto);
	/**
	* @openapi
	* /api/v1/sse/upload-photo-parallel:
	*   get:
	*     summary: Esegue l'upload delle foto trovate precedentemente con il servizio /uda/:query in parallelo e invia i progressi tramite Server-Sent Events
	*     tags:
	*       - GridFS
	*     responses:
	*       200:
	*         description: Stream di eventi SSE
	*         content:
	*           text/event-stream:
	*             schema:
	*               type: object
	*               properties:
	*                 id:
	*                   type: string
	*                 type:
	*                   type: string
	*                 mimeType:
	*                   type: string
	*       400:
	*         description: Richiesta non valida
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/sse/upload-photo-parallel", controllers.apiController.sseUploadPhotoParallel);
	/**
	* @openapi
	* /api/v1/s3:
	*   get:
	*     summary: Esegue la ricerca sul bucket s3 dei file contenuti sotto il prefisso indicato nelle variabili di ambiente
	*     tags:
	*       - AWS S3 Bucket
	*     responses:
	*       200:
	*         description: La lista di oggetti trovati
	*         content:
	*           application/json:
	*             schema:
	*               type: array
	*               items:
	*                 type: object
	*                 properties:
	*                   fileName:
	*                     type: string
	*                   size:
	*                     type: string
	*                   tag:
	*                     type: string
	*                   storage:
	*                     type: string
	*                   owner:
	*                     type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/s3", controllers.apiController.readBucketContent);
	/**
	* @openapi
	* /api/v1/s3/{prefix}:
	*   get:
	*     summary: Esegue la ricerca sul bucket s3 dei file contenuti sotto il prefisso indicato come path param
	*     tags:
	*       - AWS S3 Bucket
	*     parameters:
	*       - name: prefix
	*         in: path
	*         required: true
	*         schema:
	*           type: string
	*     responses:
	*       200:
	*         description: La lista di oggetti trovati
	*         content:
	*           application/json:
	*             schema:
	*               type: array
	*               items:
	*                 type: object
	*                 properties:
	*                   fileName:
	*                     type: string
	*                   size:
	*                     type: string
	*                   tag:
	*                     type: string
	*                   storage:
	*                     type: string
	*                   owner:
	*                     type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/s3/:prefix", controllers.apiController.readBucketContent);
	/**
	* @openapi
	* /api/v1/s3-del-one/{filename}:
	*   get:
	*     summary: Esegue la cancellazione dal bucket del file con filename quello indicato come path param
	*     tags:
	*       - AWS S3 Bucket
	*     parameters:
	*       - name: filename
	*         in: path
	*         required: true
	*         schema:
	*           type: string
	*     responses:
	*       200:
	*         description: Il nome del file cancellato oppure 0 file cancellati se nessun file è stato trovato
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       400:
	*         description: Richiesta non valida
	*         content:
	*           application/json:
	*             schema:
	*               type: array
	*               items:
	*                 type: string
	*       404:
	*         description: File non trovato
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/s3-del-one/:filename", controllers.apiController.deleteBucketFile);
	/**
	* @openapi
	* /api/v1/s3-del-many/{prefix}:
	*   get:
	*     summary: Esegue la cancellazione dal bucket dei file con prefisso quello indicato come path param
	*     tags:
	*       - AWS S3 Bucket
	*     parameters:
	*       - name: prefix
	*         in: path
	*         required: true
	*         schema:
	*           type: string
	*     responses:
	*       200:
	*         description: I nomi dei file cancellati oppure 0 file cancellati se nessun file è stato trovato
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       400:
	*         description: Richiesta non valida
	*         content:
	*           application/json:
	*             schema:
	*               type: array
	*               items:
	*                 type: string
	*       404:
	*         description: File non trovato
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*       500:
	*         description: Errore interno
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 message:
	*                   type: string
	*/
	router.get("/s3-del-many/:prefix", controllers.apiController.deleteBucketFile);
	return router;
}
