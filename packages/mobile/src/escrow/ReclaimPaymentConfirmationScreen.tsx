import ReviewFrame from '@celo/react-components/components/ReviewFrame'
import ReviewHeader from '@celo/react-components/components/ReviewHeader'
import colors from '@celo/react-components/styles/colors'
import { CURRENCY_ENUM } from '@celo/utils/src/currencies'
import BigNumber from 'bignumber.js'
import * as React from 'react'
import { withNamespaces, WithNamespaces } from 'react-i18next'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { NavigationInjectedProps } from 'react-navigation'
import { connect } from 'react-redux'
import { showError } from 'src/alert/actions'
import CeloAnalytics from 'src/analytics/CeloAnalytics'
import { CustomEventNames } from 'src/analytics/constants'
import componentWithAnalytics from 'src/analytics/wrapper'
import { ErrorMessages } from 'src/app/ErrorMessages'
import { ERROR_BANNER_DURATION } from 'src/config'
import { EscrowedPayment, reclaimPayment } from 'src/escrow/actions'
import ReclaimPaymentConfirmationCard from 'src/escrow/ReclaimPaymentConfirmationCard'
import { reclaimSuggestedFeeSelector } from 'src/escrow/reducer'
import { Namespaces } from 'src/i18n'
import { navigateBack } from 'src/navigator/NavigationService'
import { RootState } from 'src/redux/reducers'
import { isAppConnected } from 'src/redux/selectors'
import DisconnectBanner from 'src/shared/DisconnectBanner'
import { divideByWei } from 'src/utils/formatting'
import Logger from 'src/utils/Logger'
import { currentAccountSelector } from 'src/web3/selectors'

const TAG = 'escrow/ReclaimPaymentConfirmationScreen'

interface StateProps {
  isReclaiming: boolean
  e164PhoneNumber: string
  account: string | null
  fee: string | null
  dollarBalance: BigNumber
  appConnected: boolean
}

interface DispatchProps {
  reclaimPayment: typeof reclaimPayment
  showError: typeof showError
}

const mapDispatchToProps = {
  reclaimPayment,
  showError,
}

const mapStateToProps = (state: RootState): StateProps => {
  return {
    isReclaiming: state.escrow.isReclaiming,
    e164PhoneNumber: state.account.e164PhoneNumber,
    account: currentAccountSelector(state),
    fee: reclaimSuggestedFeeSelector(state),
    dollarBalance: new BigNumber(state.stableToken.balance || 0),
    appConnected: isAppConnected(state),
  }
}

type Props = NavigationInjectedProps & DispatchProps & StateProps & WithNamespaces

class ReclaimPaymentConfirmationScreen extends React.Component<Props> {
  static navigationOptions = { header: null }

  getReclaimPaymentInput(): EscrowedPayment {
    const reclaimPaymentInput = this.props.navigation.getParam('reclaimPaymentInput', '')
    if (reclaimPaymentInput === '') {
      throw new Error('Reclaim payment input missing')
    }
    return reclaimPaymentInput
  }

  getFee = () => {
    return this.props.fee || ''
  }

  onConfirm = async () => {
    const escrowedPayment = this.getReclaimPaymentInput()
    CeloAnalytics.track(CustomEventNames.escrowed_payment_reclaimed_by_sender)
    const address = this.props.account
    if (!address) {
      throw new Error("Can't reclaim funds without a valid account")
    }

    try {
      this.props.reclaimPayment(escrowedPayment.paymentID)
    } catch (error) {
      Logger.error(TAG, 'Reclaiming escrowed payment failed, show error message', error)
      this.props.showError(ErrorMessages.RECLAIMING_ESCROWED_PAYMENT_FAILED, ERROR_BANNER_DURATION)
      return
    }
  }

  onPressEdit = () => {
    CeloAnalytics.track(CustomEventNames.escrowed_payment_reclaimEdit_by_sender)
    navigateBack()
  }

  renderHeader = () => {
    const { t } = this.props
    const title = t('reclaimPayment')
    return <ReviewHeader title={title} />
  }

  renderFooter = () => {
    return this.props.isReclaiming ? (
      <ActivityIndicator size="large" color={colors.celoGreen} />
    ) : null
  }

  render() {
    const { t, isReclaiming, appConnected } = this.props
    const payment = this.getReclaimPaymentInput()
    const convertedAmount = divideByWei(payment.amount.toString())
    const convertedFee = divideByWei(this.getFee().toString())

    const currentBalance = this.props.dollarBalance
    const userHasEnough = new BigNumber(convertedFee).isLessThanOrEqualTo(currentBalance)

    return (
      <View style={styles.container}>
        <DisconnectBanner />
        <ReviewFrame
          HeaderComponent={this.renderHeader}
          FooterComponent={this.renderFooter}
          confirmButton={{
            action: this.onConfirm,
            text: t('global:confirm'),
            disabled: isReclaiming || !userHasEnough || !appConnected,
          }}
          modifyButton={{ action: this.onPressEdit, text: t('cancel'), disabled: isReclaiming }}
        >
          <ReclaimPaymentConfirmationCard
            recipientPhone={payment.recipientPhone}
            recipientContact={payment.recipientContact}
            comment={payment.message}
            amount={new BigNumber(convertedAmount)}
            currency={CURRENCY_ENUM.DOLLAR} // User can only request in Dollars
            fee={new BigNumber(convertedFee)}
          />
        </ReviewFrame>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
  },
})

export default componentWithAnalytics(
  connect<StateProps, DispatchProps, {}, RootState>(
    mapStateToProps,
    mapDispatchToProps
  )(withNamespaces(Namespaces.sendFlow7)(ReclaimPaymentConfirmationScreen))
)
