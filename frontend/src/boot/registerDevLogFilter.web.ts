/**
 * react-native-web の AppRegistry が出す開発専用の console.log を抑止する。
 */
if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes('Running application "') &&
      first.includes("appParams")
    ) {
      return;
    }
    orig.apply(console, args as []);
  };
}
