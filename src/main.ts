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

function genRecord(sheet: GoogleAppsScript.Spreadsheet.Sheet) :Record<string, string>[]{
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
    return js
}

class GitHub {
    pat: string
    baseURL: string
    constructor(pat: string, username: string, repo: string) {
        this.pat = pat
        this.baseURL = `https://api.github.com/repos/${username}/${repo}`
    }

    doSimpleRequest(url: string, method: "post" | "patch" | "get", payload: object):GoogleAppsScript.URL_Fetch.HTTPResponse{
        console.log(payload)
        const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = method === 'get' ? {
            method: method,
            headers: {
                "authorization": `Bearer ${this.pat}`,
                "X-GitHub-Api-Version": "2022-11-28",
            },
        } : {
            method: method,
            contentType: "application/json",
            payload: JSON.stringify(payload),
            headers: {
                "authorization": `Bearer ${this.pat}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "Accept": "application/vnd.github+json"
            },
        }
        const resp = UrlFetchApp.fetch(url, options)
        console.log(resp.getResponseCode().toString())
        console.log(resp.getContentText())
        return resp
    }

    doRequest<T = Response>(url: string, method: "post" | "patch" | "get", payload: object): T {
        const resp = this.doSimpleRequest(url, method, payload)
        return (JSON.parse(resp.getContentText()) as T)
    }

    createBlob(json: string): string {
        const resp = this.doRequest(this.baseURL + '/git/blobs', "post", {
            "content": JSON.stringify(json),
            "encoding": "utf-8",
        })
        return resp.sha
    }


    getTree(branchName: string): string {
        const resp = this.doRequest(`${this.baseURL}/git/trees/${branchName}`, "get", {})
        return resp.sha
    }


    createBranch(newBranchName: string, baseSha: string): string {
        const resp = this.doRequest<{ object: Response }>(this.baseURL + '/git/refs', "post", {
            "ref": "refs/heads/" + newBranchName,
            "sha": baseSha,
        })
        return resp.object.sha
    }

    createTree(fileName: string, blobSha: string, baseSha: string): string {
        const resp = this.doRequest(this.baseURL + '/git/trees', "post", {
            "tree": [
                {
                    "path": fileName,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blobSha,
                },
            ],
            "base_tree": baseSha
        })
        return resp.sha
    }

    createCommit(treeSha: string, parentSha: string): string {
        const resp = this.doRequest(this.baseURL + '/git/commits', "post", {
            "tree": treeSha,
            "message": "Sync json",
            "parents": [parentSha]
        })
        return resp.sha
    }

    updateBranch(newBranchName: string, commitSha: string) {
        this.doRequest(`${this.baseURL}/git/refs/heads/${newBranchName}`, "patch", {
            "sha": commitSha,
        })
    }
}

type Response = { sha: string }

function push() {
    const sheetName = 'master'
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName)
    if (sheet === null) {
        console.log(`failed: sheet(name is '${sheetName}') is not found.`)
        return
    }
    const json = serialize(sheet)
    console.log(json)

    const pat = PropertiesService.getScriptProperties().getProperty('GITHUB_PAT')
    if (pat === null) {
        console.log("failed: `GITHUB_PAT` property is not found.")
        return
    }

    const username = "blck-snwmn"
    const repo = "github-playground"
    const g = new GitHub(pat, username, repo)

    const basebranchName = "main"
    const currentTreeSha = g.getTree(basebranchName)

    const branchName = "feat/gasjson"
    const branchSha = g.createBranch(branchName, currentTreeSha)

    const blobSha = g.createBlob(json)
    const createdTreeSha = g.createTree("sample.json", blobSha, branchSha)
    const commitSha = g.createCommit(createdTreeSha, branchSha)

    g.updateBranch(branchName, commitSha)
}

function call() {
    const sheetName = 'master'
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName)
    if (sheet === null) {
        console.log(`failed: sheet(name is '${sheetName}') is not found.`)
        return
    }
    const json = genRecord(sheet)
    console.log(json)

    const pat = PropertiesService.getScriptProperties().getProperty('GITHUB_PAT')
    if (pat === null) {
        console.log("failed: `GITHUB_PAT` property is not found.")
        return
    }
    const username = "blck-snwmn"
    const repo = "github-playground"
    const g = new GitHub(pat, username, repo)
    g.doSimpleRequest(g.baseURL+"/actions/workflows/json.yml/dispatches", "post", { ref: "main", inputs: { "json": json } })
}

function onOpen() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    sheet.addMenu("メニュー", [
        { name: "push", functionName: "push" },
        { name: "call", functionName: "call" }
    ]);
}