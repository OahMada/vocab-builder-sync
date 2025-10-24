import type { PlasmoMessaging } from "@plasmohq/messaging"

import handleSync from "~background"

var handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  await handleSync(req.body)
  // prevent `Promised response from onMessage listener went out of scope` error in firefox
  res.send({})
}

export default handler
