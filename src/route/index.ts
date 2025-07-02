import { Hono } from "hono"
import auth from "./authRoute"
import category from "./categoryRoute"
import subCategory from "./subCategoryRoute"
import voucher from "./voucher"
import news from "./news"
import service from "./service"
import transaction from "./transaction"
import payment from "./payment-method"
import deposit from "./deposit"

const routes =  new Hono()
routes.route("/auth",auth)
routes.route("/category", category)
routes.route("/service", service)
routes.route("/subcategory", subCategory)
routes.route("/voucher", voucher)
routes.route("/news", news)
routes.route("/transactions", transaction)
routes.route("/payment-methods", payment)
routes.route("/deposit", deposit)





export default routes