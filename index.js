const axios = require("axios");

const CryptoJS = require("crypto-js");

const config = {
    url : "https://api.bitkub.com",
    key : "",
    secret : "",
    refresh_time : 10 //minute
}

const HEADER = () => {
  return {
    headers: {
      Accept: "application/json",
      "Content-type": "application/json",
      "X-BTK-APIKEY": config.key,
    },
  };
};

const HASH_DATA = (data) => {
  const sig = CryptoJS.HmacSHA256(JSON.stringify(data), config.secret).toString();
  data.sig = sig;
  return data;
};

// option = {buy or sell}
// POST /api/market/place-bid/test
const place_order = async (option, symbol, amout, rate, type, client_id) => {
  const url =
    option == "buy"
      ? `${config.url}/api/market/place-bid`
      : `${config.url}/api/market/place-ask`;
  const ts = Date.now();
  const data = {
    ts: ts,
    sym: symbol,
    amt: amout,
    rat: rate,
    typ: type,
    client_id: client_id,
  };
  const sign_data = HASH_DATA(data);
  try {
    const res = await axios.post(url, sign_data, HEADER());
    console.log(res.data);
  } catch (e) {
    console.error(e);
  }
};

const tickers = async () => {
  const url = `${config.url}/api/market/ticker`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (e) {
    return e;
  }
};

const gainer = async () => {
  const data = await tickers();
  const sync = [];
  for (let i in data) {
    sync.push({
      symbol: i,
      change: data[i]["percentChange"],
      last: data[i]["last"],
    });
  }
  return sync.sort((a, b) => b.change - a.change);
};

// POST /api/market/wallet
// get all assets
const get_wallet = async () => {
  const url = `${config.url}/api/market/wallet`;
  const ts = Date.now();
  //   optional
  const gain = await gainer();
  const data = {
    ts: ts,
  };
  const sign_data = HASH_DATA(data);
  try {
    const res = await axios.post(url, sign_data, HEADER());
    const asseet = [];
    for (let i in res.data.result) {
      let amout = 0;
      for (let j in gain) {
        if (gain[j]["symbol"] == `THB_${i}`) {
          amout = gain[j]["last"];
        }
      }
      asseet.push({
        symbol: i,
        balance: res.data.result[i],
        amout: res.data.result[i] * amout,
      });
    }
    return asseet.sort((a, b) => b.amout - a.amout);
  } catch (e) {
    console.error(e);
  }
};

// check active asset in wallet
const my_assets = async () => {
  const wallet = await get_wallet();
  const active = [];
  for (let i in wallet) {
    if (wallet[i]["amout"] > 0) {
      active.push(wallet[i]);
    }
  }
  return active;
};

const my_thb = async () => {
  const wallet = await get_wallet();
  for (let i in wallet) {
    if (wallet[i]["symbol"] == "THB") {
      return wallet[i];
    }
  }
};

const top_gainer = async (counter) => {
  let top_asset = [];
  const gain = await gainer();
  for (let i = 0; i < counter; i++) {
    top_asset.push(gain[i]);
  }
  return top_asset;
};

// test run
(async () => {
  console.log("Bot is running .... ");
  setInterval(async () => {
    
  const my_wallet = await my_assets();
  const top = await top_gainer(1);
  const money = await my_thb();
  var now = new Date();

  var hours = now.getHours();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();
    for (let i in my_wallet) {
      if (`THB_${my_wallet[i]["symbol"]}` != top[0]["symbol"]) {
        console.log(`Sell THB_${my_wallet[i]["symbol"]}`)
        await place_order(
          (option = "sell"),
          (symbol = `THB_${my_wallet[i]["symbol"]}`),
          (amout = my_wallet[i]["balance"]),
          (rate = 0),
          (type = "market"),
          (client_id = "Bot sell")
        );
        if (money["balance"] > 0) {
          console.log(`Buy ${top[0]["symbol"]}`)
          await place_order(
            (option = "buy"),
            (symbol = top[0]["symbol"]),
            (amout = parseFloat(money["balance"])),
            (rate = 0),
            (type = "market"),
            (client_id = "Bot buy")
          );
        } else {
          console.log("Money is low");
        }
      }
    }
    
  console.log(hours + ":" + minutes + ":" + seconds); 
  }, config.refresh_time * 60 * 1000);
})();
