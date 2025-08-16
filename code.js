const CANVAS_SIDE = 1500;
const GRID_SIDE = 150;
const CELL_SIDE = CANVAS_SIDE / GRID_SIDE;


class UI {
  #ctx;
  #canvas;
  init() {
    const body = document.getElementsByTagName("body")[0];
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = CANVAS_SIDE;
    this.#canvas.height = CANVAS_SIDE;
    this.#ctx = this.#canvas.getContext("2d");
    body.appendChild(this.#canvas);
  }

  renderGrid() {
    for (let y = 0; y <= GRID_SIDE; y++) {
      for (let x = 0; x <= GRID_SIDE; x++) {
        this.#ctx.strokeRect(x * CELL_SIDE, y * CELL_SIDE, CELL_SIDE, CELL_SIDE);
      }
    }
  }
  reset() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.renderGrid();
  }

  markAdded(added) {
    for (const pos of added) {
      const[x,y] = pos.split(",").map(i => Number.parseInt(i))
      this.#ctx.fillRect(x * CELL_SIDE, y * CELL_SIDE, CELL_SIDE, CELL_SIDE);
    }
  }

  markMiss(x, y) {
    this.#ctx.fillStyle = "rgba(255,0,0,0.5)";
    this.#ctx.fillRect(x * CELL_SIDE, y * CELL_SIDE, CELL_SIDE, CELL_SIDE);
    this.#ctx.fillStyle = "black";
  }

  markHit(x, y) {
    this.#ctx.fillStyle = "rgba(0,255,0,0.5)";
    this.#ctx.fillRect(x * CELL_SIDE, y * CELL_SIDE, CELL_SIDE, CELL_SIDE);
    this.#ctx.fillStyle = "black";
  }
}

class BloomFilter {
  #buckets;
  #size;
  #hashCount;

  constructor(size = 4096, hashCount = 2) {
    this.#size = size;
    this.#hashCount = hashCount;
    this.#buckets = new Uint8Array(Math.ceil(size / 8));
  }

  add(item) {
    if (typeof item != "string") {
      throw new Error("Only strings");
    }
    const hashA = this.#hash1(item, this.#size);
    const hashB = this.#hash2(item, this.#size);
    for (let i = 0; i < this.#hashCount; i++) {
      const index = (hashA + i * hashB) % this.#size;
      this.#setBit(index);
    }
  }

  notInSet(item) {
    if (typeof item != "string") {
      throw new Error("Only strings");
    }
    const hashA = this.#hash1(item, this.#size);
    const hashB = this.#hash2(item, this.#size);
    for (let i = 0; i < this.#hashCount; i++) {
      const index = (hashA + i * hashB) % this.#size;
      if (!this.#getBit(index)) {
        return true;
      }
    }
    return false;
  }

  likely(item) {
    return !this.notInSet(item);
  }

  #hash1(str, size) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
    }
    return Math.abs(hash) % size;
  }

  #hash2(str, size) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 3) ^ str.charCodeAt(i);
    }
    return Math.abs(hash) % size;
  }

  #setBit(index) {
    const byte = Math.floor(index / 8);
    const offset = index % 8;
    this.#buckets[byte] |= 1 << offset;
  }

  #getBit(index) {
    const byte = Math.floor(index / 8);
    const offset = index % 8;
    return (this.#buckets[byte] & (1 << offset)) !== 0;
  }
}

class Simulation {
  constructor(k, n, m) {
    this.hashes = k;
    this.items = n;
    this.bits = m;

    this.hits = 0;
    this.misses = 0;
    this.checks = 0;

    this.b = new BloomFilter(this.bits, this.hashes);
    this.added = this.generateTestData(this.items);
  }

  generateTestData(items) {
    const positions = new Set();
    console.log("Generating ", items, " items")
    const arr = new Array(GRID_SIDE * GRID_SIDE).fill(0)
    for(let i = 0; i < items; i++) {
        arr[i] = 1;
    }
    shuffle(arr);
    for(let i = 0; i < arr.length; i++) {
        if(arr[i] === 1) {
            const x = Math.floor(i / GRID_SIDE);
            const y  = i % GRID_SIDE
            const key = `${x},${y}`
            positions.add(key)
            this.b.add(key)
        }
    }
    return positions
  }
}

const ui = new UI();
ui.init();
ui.reset();

let running = false;
let batchSize;;


const startSim = () => {
  if (running) return;
  ui.reset()
  running = true;
  const sim = new Simulation(hashes.value, items.value, bits.value);
  ui.markAdded(sim.added);
  batchSize = iterations.value;
  run({ x: 0, y: 0, sim: sim });
};

const run = (args) => {
  let batchCounter = 0;
  while (batchCounter < batchSize && args.y < GRID_SIDE) {
    if (args.x === GRID_SIDE) {
      args.x = 0;
      args.y++;
    }

    if (args.y === GRID_SIDE) {
      running = false;
      return;
    }

    const key = `${args.x},${args.y}`;
    const maybeHas = args.sim.b.likely(key);

    if (maybeHas) {
      const falseAlarm = !args.sim.added.has(key);
      if (falseAlarm) {
        args.sim.misses++;
        ui.markMiss(args.x, args.y);
      } else {
        ui.markHit(args.x, args.y);
      }
    } else {
      args.sim.hits++;
    }

    args.sim.checks++;
    args.x++;
    batchCounter++;
  }

  this.checks.textContent = "checks: " + args.sim.checks;
  this.hits.textContent = "correct: " + args.sim.hits;
  this.misses.textContent = "false: " + args.sim.misses;
  if (args.sim.checks > 0 && args.sim.misses > 0) {
    this.rate.textContent =
      "false positive rate: " +
      ((args.sim.misses / args.sim.checks) * 100).toFixed(2) +
      "%";
  }

  requestAnimationFrame(() => run(args));
};

function shuffle(array) {
  let count = array.length;
  let temp;
  let index;

  while (count > 0) {
    index = Math.floor(Math.random() * count);
    count--;
    temp = array[count];
    array[count] = array[index];
    array[index] = temp;
  }

  return array;
}