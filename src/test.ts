import launch from './job'

async function run() {
  const job = launch()
  const rv = await job.init({ name: 'hello', title: 'your boss' })
  console.log('from main %s: %s', process.pid, rv)
  const rv2 = await job.init({ name: 'hello2', title: 'CEO' })
  console.log('from main %s: %s', process.pid, rv2)
  job.kill()
}

run()
