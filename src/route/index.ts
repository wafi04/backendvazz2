import { Hono } from "hono"
import auth from "./authRoute"
import category from "./categoryRoute"
import subCategory from "./subCategoryRoute"

const routes =  new Hono()
routes.route("/auth",auth)
routes.route("/category",category)
routes.route("/subCategory",subCategory)


export default routes