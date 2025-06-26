export function getWIBTime() {
  const now = new Date();
  const wibString = now.toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
  });
  return new Date(wibString);
}