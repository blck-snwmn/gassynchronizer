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

class GitHub {
    pat: string
    constructor(pat: string) {
        this.pat = pat
    }

    doRequest<T = Response>(url: string, method: "post" | "patch" | "get", payload: object): T {
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

        return (JSON.parse(resp.getContentText()) as T)
    }
}

type Response = { sha: string }

function createBlob(u: string, pat: string, json: string): string {
    const resp = (new GitHub(pat)).doRequest(u + '/git/blobs', "post", {
        "content": JSON.stringify(json),
        "encoding": "utf-8",
    })
    return resp.sha
}

function getTree(u: string, pat: string, branchName: string): string {
    const resp = (new GitHub(pat)).doRequest(`${u}/git/trees/${branchName}`, "get", {})
    return resp.sha
}


function createBranch(u: string, pat: string, newBranchName: string, baseSha: string): string {
    const resp = (new GitHub(pat)).doRequest<{ object: Response }>(u + '/git/refs', "post", {
        "ref": "refs/heads/" + newBranchName,
        "sha": baseSha,
    })
    return resp.object.sha
}

function createTree(u: string, pat: string, fileName: string, blobSha: string, baseSha: string): string {
    const resp = (new GitHub(pat)).doRequest(u + '/git/trees', "post", {
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

function createCommit(u: string, pat: string, treeSha: string, parentSha: string): string {
    const resp = (new GitHub(pat)).doRequest(u + '/git/commits', "post", {
        "tree": treeSha,
        "message": "Sync json",
        "parents": [parentSha]
    })
    return resp.sha
}

function updateBranch(u: string, pat: string, newBranchName: string, commitSha: string) {
    (new GitHub(pat)).doRequest(`${u}/git/refs/heads/${newBranchName}`, "patch", {
        "sha": commitSha,
    })
}

function main() {
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
    const url = `https://api.github.com/repos/${username}/${repo}`

    const basebranchName = "main"
    const currentTreeSha = getTree(url, pat, basebranchName)

    const branchName = "feat/gasjson"
    const branchSha = createBranch(url, pat, branchName, currentTreeSha)

    const blobSha = createBlob(url, pat, json)
    const createdTreeSha = createTree(url, pat, "sample.json", blobSha, branchSha)
    const commitSha = createCommit(url, pat, createdTreeSha, branchSha)

    updateBranch(url, pat, branchName, commitSha)
}

function onOpen() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    sheet.addMenu("メニュー", [{ name: "json", functionName: "main" }]);
}