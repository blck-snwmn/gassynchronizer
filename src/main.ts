function serialize(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
    const x = sheet.getRange('A:C')
    const v = x.getValues().map(v => v.map(String))
    const [jsonkeys, ...values] = v // head(jsonkeys) is json key
    let js: Record<string, string>[] = [];
    for (const vs of values) {
        let j: Record<string, string> = {}
        if (vs[0] === '') {
            break  // skip if cell value is empty
        }
        jsonkeys.forEach((v, i) => {
            j[v] = vs[i]
        })
        js.push(j)
    }
    return JSON.stringify(js)
}

function main() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('master')
    if (sheet === null) {
        console.log("failed: sheet(name is 'master') is not found.")
        return
    }
    const json = serialize(sheet)
    console.log(json)
}

function onOpen() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    sheet.addMenu("メニュー", [{ name: "json", functionName: "main" }]);
}