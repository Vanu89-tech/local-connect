import { Router, type IRouter } from "express";
import healthRouter from "./health";
import poiRouter from "./poi";
import socialRouter from "./social";

const router: IRouter = Router();

router.use(healthRouter);
router.use(poiRouter);
router.use(socialRouter);

export default router;
