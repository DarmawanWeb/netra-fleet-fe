import Detail from './Detail';

/** One exported page serves every id; the server answers /substation/<section>/<id> with it. */
export function generateStaticParams() {
  return [{ id: '0' }];
}

export default function Page() {
  return <Detail />;
}
