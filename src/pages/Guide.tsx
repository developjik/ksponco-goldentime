import { Link } from 'react-router-dom';
import { TOTAL_CAPACITY, TOTAL_CAPACITY_SOURCE, formatCount } from '../lib/congestion';

export default function Guide() {
  return (
    <div className="home">
      <h1 className="page-title">이용안내</h1>

      <section className="panel" aria-labelledby="what-title">
        <div className="panel-head">
          <h2 id="what-title">골든타임이란?</h2>
        </div>
        <p>
          올림픽공원 주차장이 꽉 차기 전, 빈자리가 가장 많아 여유롭게 들어갈 수 있는 시간대를
          뜻합니다. 이 서비스는 지금 상태를 먼저 알려 주고, 이어서 그 시간대를 미리 알려주는
          것을 목표로 합니다.
        </p>
      </section>

      <section className="panel" aria-labelledby="source-title">
        <div className="panel-head">
          <h2 id="source-title">데이터 출처와 갱신</h2>
        </div>
        <dl className="source-list">
          <div className="source-row">
            <dt>실시간 주차대수</dt>
            <dd>
              한국체육산업개발(주) 「올림픽공원 실시간 주차현황」 공개 API(ksponco.or.kr). 60초마다
              자동, 새로고침 버튼으로 즉시 갱신.
            </dd>
          </div>
          <div className="source-row">
            <dt>전체 수용 능력</dt>
            <dd>
              약 {formatCount(TOTAL_CAPACITY)}대 —{' '}
              <a href={TOTAL_CAPACITY_SOURCE.url} target="_blank" rel="noreferrer noopener">
                올림픽공원 홈페이지 자주하는 질문
              </a>
              의 "2,800여 대" 기준. 빈 자리 수와 주차율은 이 값을 바탕으로 계산합니다.
            </dd>
          </div>
          <div className="source-row">
            <dt>방문 중 추이</dt>
            <dd>페이지를 연 뒤 수집한 측정값만 표시. 다시 열면 초기화됩니다.</dd>
          </div>
          <div className="source-row">
            <dt>예측·히트맵</dt>
            <dd>
              공공데이터포털 「한국체육산업개발주식회사_실시간 주차현황」 시간별 연계 데이터(2025년
              7,803건)를 요일×시간 평균으로 집산해{' '}
              <Link to="/predict">골든타임 예측·히트맵</Link>을 제공합니다.
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="level-title">
        <div className="panel-head">
          <h2 id="level-title">혼잡 단계</h2>
        </div>
        <p className="muted small">
          주차율 구간에 따라 네 단계로 나타냅니다. 단계 경계는 이 서비스의 기준입니다.
        </p>
        <ul className="level-list">
          <li>
            <span className="dot lv-good" aria-hidden="true" /> 여유 — 주차율 40% 미만
          </li>
          <li>
            <span className="dot lv-normal" aria-hidden="true" /> 보통 — 40% 이상 70% 미만
          </li>
          <li>
            <span className="dot lv-busy" aria-hidden="true" /> 혼잡 — 70% 이상 85% 미만
          </li>
          <li>
            <span className="dot lv-severe" aria-hidden="true" /> 매우 혼잡 — 85% 이상
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="fee-title">
        <div className="panel-head">
          <h2 id="fee-title">요금·문의</h2>
        </div>
        <p>
          주차 요금, 입출차 시간, 목적지별 주차장은{' '}
          <a
            href="https://www.ksponco.or.kr/olympicpark/parkingInfo?mid=a20111000000"
            target="_blank"
            rel="noreferrer noopener"
          >
            올림픽공원 공식 주차 안내
          </a>
          를 참고하세요. 이 서비스는 정보를 보여주기만 하며 주차 예약이나 정산을 처리하지
          않습니다.
        </p>
      </section>
    </div>
  );
}
