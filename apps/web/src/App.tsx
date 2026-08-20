import { useCallback, useEffect, useState } from 'react'
import './App.css'

type ReviewOffer = {
  id: string
  marketplace: string
  title: string
  imageUrl: string | null
  currentPrice: number
  originalPrice: number | null
  discountPercent: number | null
  score: number
  couponCode: string | null
  detectedAt: string
}

type Publication = {
  id: string
  product: string
  channel: string
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
}

type QueueItem = {
  id: string | null
  state: string
  offerId: string
  product: string
  marketplace: string | null
  scheduledAt: string
}

function money(value: number | null) {
  if (value === null) return '-'

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dateTime(value: string | null) {
  if (!value) return '-'

  return new Date(value).toLocaleString('pt-BR')
}

function App() {
  const [reviewOffers, setReviewOffers] = useState<ReviewOffer[]>([])
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])

  const loadData = useCallback(async () => {
    try {
      setError(null)

      const [reviewResponse, publicationsResponse, queueResponse] =
      await Promise.all([
        fetch('/api/offers/review'),
        fetch('/api/publications'),
        fetch('/api/queue'),
      ])

      if (
        !reviewResponse.ok ||
        !publicationsResponse.ok ||
        !queueResponse.ok
      ) {
        throw new Error('Não foi possível carregar os dados.')
      }

      const reviewData = await reviewResponse.json()
      const publicationsData = await publicationsResponse.json()
      const queueData = await queueResponse.json()

      setReviewOffers(reviewData)
      setQueue(queueData)
      setPublications(publicationsData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar os dados.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function approveOffer(id: string) {
    try {
      setApproving(id)

      const response = await fetch(`/api/offers/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      })

      if (!response.ok) {
        throw new Error('Não foi possível aprovar a oferta.')
      }

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao aprovar oferta.',
      )
    } finally {
      setApproving(null)
    }
  }

  const publishedCount = publications.filter(
    (publication) => publication.status === 'PUBLISHED',
  ).length

  const failedCount = publications.filter(
    (publication) => publication.status === 'FAILED',
  ).length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span>🔥</span>
          <div>
            <strong>Ofertas Bot</strong>
            <small>Afiliados</small>
          </div>
        </div>

        <nav>
          <a className="active" href="#dashboard">
            Dashboard
          </a>

          <a href="#review">
            Revisão
          </a>

          <a href="#publications">
            Publicações
          </a>
        </nav>
      </aside>

      <main className="content">
        <header className="page-header" id="dashboard">
          <div>
            <h1>Dashboard</h1>
            <p>Controle das ofertas e publicações.</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => void loadData()}
          >
            Atualizar
          </button>
        </header>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <section className="stats">
          <div className="stat-card">
            <span>Aguardando revisão</span>
            <strong>{reviewOffers.length}</strong>
          </div>

          <div className="stat-card">
            <span>Publicadas</span>
            <strong>{publishedCount}</strong>
          </div>

          <div className="stat-card">
            <span>Com erro</span>
            <strong>{failedCount}</strong>
          </div>

          <div className="stat-card">
            <span>Na fila</span>
            <strong>{queue.length}</strong>
          </div>
        </section>

        <section className="panel" id="review">
          <div className="panel-header">
            <div>
              <h2>Ofertas em revisão</h2>
              <p>Ofertas que precisam de aprovação manual.</p>
            </div>

            <span className="badge">
              {reviewOffers.length}
            </span>
          </div>

          {loading ? (
            <p className="empty">Carregando...</p>
          ) : reviewOffers.length === 0 ? (
            <p className="empty">
              Nenhuma oferta aguardando revisão.
            </p>
          ) : (
            <div className="review-list">
              {reviewOffers.map((offer) => (
                <article className="offer-card" key={offer.id}>
                  <div className="offer-info">
                    <span className="marketplace">
                      {offer.marketplace === 'MERCADO_LIVRE'
                        ? 'Mercado Livre'
                        : 'Shopee'}
                    </span>

                    <h3>{offer.title}</h3>

                    <div className="prices">
                      {offer.originalPrice && (
                        <span className="old-price">
                          {money(offer.originalPrice)}
                        </span>
                      )}

                      <strong>
                        {money(offer.currentPrice)}
                      </strong>
                    </div>

                    <div className="offer-meta">
                      {offer.discountPercent && (
                        <span>
                          {offer.discountPercent}% OFF
                        </span>
                      )}

                      <span>Score {offer.score}</span>

                      {offer.couponCode && (
                        <span>
                          Cupom {offer.couponCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    disabled={approving === offer.id}
                    onClick={() => void approveOffer(offer.id)}
                  >
                    {approving === offer.id
                      ? 'Aprovando...'
                      : 'Aprovar'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Fila de publicação</h2>
            <p>Ofertas aguardando processamento.</p>
          </div>

          <span className="badge">
            {queue.length}
          </span>
        </div>

        {queue.length === 0 ? (
          <p className="empty">
            Nenhuma oferta aguardando na fila.
          </p>
        ) : (
          <div className="review-list">
            {queue.map((item) => (
              <article
                className="offer-card"
                key={item.id ?? item.offerId}
              > 
                <div className="offer-info">
                  <span className="marketplace">
                    {item.marketplace === 'MERCADO_LIVRE'
                      ? 'Mercado Livre'
                      : item.marketplace === 'SHOPEE'
                        ? 'Shopee'
                        : 'Marketplace'}
                  </span>

                  <h3>{item.product}</h3>

                  <div className="offer-meta">
                    <span>{item.state.toUpperCase()}</span>

                    <span>
                      Previsto: {dateTime(item.scheduledAt)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

        <section className="panel" id="publications">
          <div className="panel-header">
            <div>
              <h2>Últimas publicações</h2>
              <p>Histórico recente do bot.</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Canal</th>
                  <th>Status</th>
                  <th>Publicado em</th>
                </tr>
              </thead>

              <tbody>
                {publications.map((publication) => (
                  <tr key={publication.id}>
                    <td>{publication.product}</td>
                    <td>{publication.channel}</td>
                    <td>
                      <span
                        className={`status ${publication.status.toLowerCase()}`}
                      >
                        {publication.status}
                      </span>
                    </td>
                    <td>
                      {dateTime(
                        publication.publishedAt ??
                          publication.scheduledAt,
                      )}
                    </td>
                  </tr>
                ))}

                {!loading && publications.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Nenhuma publicação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App