import { Router } from "express";
import { controllers } from "../../../../controllers/index.js";

export const apiRoutes = (router: Router) => {
	/**
	* @openapi
	* /api/v1/collection/fields:
	*   get:
	*     summary: Esegue la query per ottenere l'elenco dei campi di un documento della collection indicata nel file env
	*     tags:
	*       - v1
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
	router.get("/collection/fields", controllers.apiController.getFields);
	/**
	* @openapi
	* /api/v1/collection/get/{query}:
	*   get:
	*     summary: Esegue la query per la ricerca dei documenti di cui prelevare i file con la query passata come query param
	*     tags:
	*       - v1
	*       - Mongo
	*     parameters:
	*       - name: query
	*         in: path
	*         required: true
	*         schema:
	*           type: string
	*     responses:
	*       200:
	*         description: La lista di documenti trovati
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
	router.get("/collection/get/:query", controllers.apiController.getData);
	/**
	* @openapi
	* /api/v1/upload-file:
	*   get:
	*     summary: Esegue l'upload dei file trovate precedentemente con il servizio /collection/:query
	*     tags:
	*       - v1
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
	router.get("/upload-file", controllers.apiController.uploadFile);
	/**
	* @openapi
	* /api/v1/upload-file-parallel:
	*   get:
	*     summary: Esegue l'upload dei file trovati precedentemente con il servizio /collection/:query in parallelo
	*     tags:
	*       - v1
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
	router.get("/upload-file-parallel", controllers.apiController.uploadFileParallel);
	/**
	* @openapi
	* /api/v1/sse/upload-file:
	*   get:
	*     summary: Esegue l'upload dei file trovati precedentemente con il servizio /collection/:query e invia i progressi tramite Server-Sent Events
	*     tags:
	*       - v1
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
	router.get("/sse/upload-file", controllers.apiController.sseUploadFile);
	/**
	* @openapi
	* /api/v1/sse/upload-file-parallel:
	*   get:
	*     summary: Esegue l'upload dei file trovati precedentemente con il servizio /collection/:query in parallelo e invia i progressi tramite Server-Sent Events
	*     tags:
	*       - v1
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
	router.get("/sse/upload-file-parallel", controllers.apiController.sseUploadFileParallel);
	/**
	* @openapi
	* /api/v1/s3:
	*   get:
	*     summary: Esegue la ricerca sul bucket s3 dei file contenuti sotto il prefisso indicato nelle variabili di ambiente
	*     tags:
	*       - v1
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
	*       - v1
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
	* /api/v1/s3-download/{filename}:
	*   get:
	*     summary: Esegue il download dal bucket del file con filename quello indicato come path param
	*     tags:
	*       - v1
	*       - AWS S3 Bucket
	*     parameters:
	*       - name: filename
	*         in: path
	*         required: true
	*         schema:
	*           type: string
	*     responses:
	*       200:
	*         description: Il file
	*         content:
	*           multipart/form-data:
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
	router.get("/s3-download/:filename", controllers.apiController.downloadBucketFile);
	/**
	* @openapi
	* /api/v1/s3-del-one/{filename}:
	*   get:
	*     summary: Esegue la cancellazione dal bucket del file con filename quello indicato come path param
	*     tags:
	*       - v1
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
	*       - v1
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
