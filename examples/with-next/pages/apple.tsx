import { GetServerSideProps } from 'next'

const Apple = () => {
  return <div>Apple</div>
}

export default Apple

export const getServerSideProps: GetServerSideProps = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return {
    props: {},
  }
}
