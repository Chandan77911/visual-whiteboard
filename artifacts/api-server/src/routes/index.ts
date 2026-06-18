import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notesRouter from "./notes";
import blocksRouter from "./blocks";
import graphRouter from "./graph";
import summaryRouter from "./summary";
import aiRouter from "./ai";
import flashcardsRouter from "./flashcards";
import mindmapsRouter from "./mindmaps";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/notes", notesRouter);
router.use("/blocks", blocksRouter);
router.use("/graph", graphRouter);
router.use("/summary", summaryRouter);
router.use("/ai", aiRouter);
router.use("/flashcards", flashcardsRouter);
router.use("/mindmaps", mindmapsRouter);

export default router;
