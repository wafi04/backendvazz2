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
import LoggerRoutes from "./logger"
import depositAnalytics from "./anaylitics/deposit"
import userAnalytics from "./userAnalytics"
import balanceRoutes from "./balance"
import transactionAdmin from "./anaylitics/transactionAnalytics"
import callback from "./callback"
import print from "./export"

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
routes.route('/admin',LoggerRoutes)
routes.route('/admin/user', userAnalytics)
routes.route('/balance', balanceRoutes)
routes.route('/callback',callback)
routes.route('/transactions', transactionAdmin)
routes.route('/print',print)





export default routes