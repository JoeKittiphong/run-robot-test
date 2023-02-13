const CryptoJS = require("crypto-js");
const axios = require("axios");

const config = {
  url: "https://api.bitkub.com",
  key: "739c1cc50fbd079f2058f6f0a8fd4f6d",
  secret: "815121d54ffe314faae0102d50a79519",
  refresh: 10,
};

//---------------------------------------------
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
  const sig = CryptoJS.HmacSHA256(
    JSON.stringify(data),
    config.secret
  ).toString();
  data.sig = sig;
  return data;
};
//-------------------------------------------

const ticker = async () => {
  try {
    const coin = (await axios.get(`${config.url}/api/market/ticker`)).data;
    const my_coin = [];
    for (let i in coin) {
      my_coin.push({
        symbol: i,
        change: coin[i]["percentChange"],
        last: coin[i]["last"],
      });
    }
    return my_coin.sort((a, b) => b.change - a.change);
  } catch (e) {
    return e;
  }
};

const top = async (counter) => {
  const coin = await ticker();
  let gainer = [];
  for (let i = 0; i < counter; i++) {
    gainer.push(coin[i]);
  }
  return gainer;
};

const wallet = async () => {
  try {
    const data = { ts: Date.now() };
    const coin = (
      await axios.post(
        `${config.url}/api/market/wallet`,
        HASH_DATA(data),
        HEADER()
      )
    ).data.result;

    const my_coin = [];
    const gainer = await ticker();
    for (let i in coin) {
      let amount = 0;
      for (let j in gainer) {
        if (gainer[j]["symbol"] == `THB_${i}`) {
          amount = gainer[j]["last"];
        }
      }
      if (coin[i] != 0 || i == "THB") {
        my_coin.push({
          symbol: i,
          balance: coin[i],
          net: amount * coin[i],
        });
      }
    }
    return my_coin.sort((a, b) => b.balance - a.balance);
  } catch (e) {
    return e;
  }
};

//--------------------------------------------------------------------
//--------------------------------------------------------------------
const place_order = async (option, symbol, amout) => {
  const mode = ""; //'/test' = test, without '/test' = real
  const url =
    option == "buy"
      ? `${config.url}/api/market/place-bid${mode}`
      : `${config.url}/api/market/place-ask${mode}`;
  const ts = Date.now();
  const data = {
    ts: ts,
    sym: symbol,
    amt: amout,
    rat: 0,
    typ: "market",
  };
  const sign_data = HASH_DATA(data);
  try {
    const res = await axios.post(url, sign_data, HEADER());
    console.log((res.data));
  } catch (e) {
    console.error(e);
  }
};

const my_thb = async () => {
  return (await wallet()).find((object) => object.symbol === "THB").balance;
};

const is_gainer = async (top_no) => {
  const my_wallet = await wallet();
  const top_gain = await top(top_no);
  for (let i in my_wallet) {
    for (let j in top_gain) {
      if (`THB_${my_wallet[i]["symbol"]}` == top_gain[j]["symbol"]) {
        return true;
      }
    }
  }
  return false;
};

// เช็คในกระเป๋าว่ามีเงินรึป่าว
// ----> ถ้าไม่มีเงิน --- เช็คในกระเป๋าว่าถือเหรียญที่ติด top gainer หรือไม่
//    +----> ถ้าไม่มีเหรียญ top gainer ให้ขายเหรียญทิ้ง
//    +----> ถ้ามีเหรียญที่ติด top gainer ไม่ต้องทำอะไร
// ----> ถ้ามีเงิน ให้ซื้อเหรียญที่ติด top gainer


let trade = async () => {
  let date = new Date();
  let time = date.toLocaleTimeString();
  let day = `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
  const wallet_ = await wallet();
  const top_ = await top(1);

  console.log(
    "================================================================"
  );
  console.log(
    "================================================================"
  );

  console.log(`Balance is ${await my_thb()} bath`);
  console.log(`Top gainner is ${top_[0]["symbol"]}`);
  console.log(
    `In my wallet THB_${wallet_[0]["symbol"]} : ${wallet_[0]["balance"]}`
  );
  // เช็คในกระเป๋าว่ามีเงินรึป่าว
  if ((await my_thb()) <= 0) {
    // ----> ถ้าไม่มีเงิน
    // ----> เช็คในกระเป๋าว่าถือเหรียญที่ติด top gainer หรือไม่
    if (!(await is_gainer(3))) {
      //  +----> ถ้าไม่มีเหรียญ top gainer ให้ขายเหรียญทิ้ง
      for (let i in wallet_) {
        if (wallet_[i]["net"] >= 10) {
          console.log(`${day} : ${time}`);
          console.log(`Sell ${wallet_[i]["symbol"]}`);
          await place_order(
            (option = "sell"),
            (symbol = `THB_${wallet_[i]["symbol"]}`),
            (amount = wallet_[i]["balance"])
          );
        }
      }
      console.log(`Buy ${top_[0]["symbol"]}`);
      await place_order(
        (option = "buy"),
        (symbol = top_[0]["symbol"]),
        (amount = await my_thb())
      );
      return;
    } else {
      //  +----> ถ้ามีเหรียญที่ติด top gainer ไม่ต้องทำอะไร
      console.log(`${day} : ${time}`);
      console.log("Do not");
      return;
    }
  } else {
    // ----> ถ้ามีเงิน ให้ซื้อเหรียญที่ติด top gainer
    console.log(`${day} : ${time}`);
    console.log(`Buy top gainer no.1`);
    await place_order(
      (option = "buy"),
      (symbol = top_[0]["symbol"]),
      (amount = await my_thb())
    );
  }
};

console.log(`Bot tade is running`);
async () => {
  await trade();
  console.log("initialed ... start");
};

setInterval(async () => {
  await trade();
}, config.refresh * 10 * 1000);
