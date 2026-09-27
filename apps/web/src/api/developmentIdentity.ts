// Keep the local UI identity aligned with the authoritative real-sample fixture.
export const DEV_TENANT_ID = "demo-real-sample-20260921";

/**
 * 本机开发身份。**这是服务端真正认的身份**（请求头），不是纯展示用的假名 ——
 * 「我负责的」这类判断必须与它同源，否则界面说的"我"和落库的负责人是两个人。
 */
export const DEV_OPERATOR_ID = "dev-operator";
