import React, { useContext, useCallback, useState } from 'react'
import {
  Spin,
  Modal,
  Button,
  Form,
  Tooltip,
  Icon,
  Typography,
  Descriptions,
  Alert
} from 'antd'
import styled from 'styled-components/macro'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import { ethers } from 'ethers'
import { withFormik } from 'formik'
import humanizeDuration from 'humanize-duration'
import { WalletContext } from 'contexts/wallet-context'
import { gtcrEncode, ItemTypes, typeDefaultValues } from '@kleros/gtcr-encoder'
import InputSelector from 'components/input-selector'
import ETHAmount from 'components/eth-amount'
import useFactory from 'hooks/factory'
import { TourContext } from 'contexts/tour-context'
import { addPeriod, capitalizeFirstLetter, getArticleFor } from 'utils/string'
import useNativeCurrency from 'hooks/native-currency'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledSpin = styled(Spin)`
  height: 60px;
  width: 100%;
  align-items: center;
  justify-content: center;
  display: flex;
`

const StyledModal = styled(Modal)`
  text-transform: capitalize;
  & > .ant-modal-content {
    border-top-left-radius: 14px;
    border-top-right-radius: 14px;
  }
`

const StyledAlert = styled(Alert)`
  margin-bottom: 12px;
  text-transform: initial;
`

const StyledParagraph = styled(Typography.Paragraph)`
  text-transform: none;
`

const SUBMISSION_FORM_ID = 'submitItemForm'

export interface Column {
  label: string
  description: string
  type: string
  allowedFileTypes: string
}

const _SubmissionForm: React.FC<{
  style: any
  columns: Column[]
  setFieldValue: (fieldName: string, fileURI: string) => void
  handleSubmit: () => void
  disabledFields: boolean[]
  values: any
  errors: { [label: string]: any }
  touched: { [label: string]: boolean }
  status: {
    setFileToUpload: (f: (b: boolean) => void) => void
    setFileAsUploaded: (f: (b: boolean) => void) => void
  }
}> = p => (
  <Form onSubmit={p.handleSubmit} id={SUBMISSION_FORM_ID}>
    {p.columns &&
      p.columns.length > 0 &&
      p.columns.map((column, index) => (
        <InputSelector
          style={p.style}
          type={column.type}
          name={`${column.label}`}
          allowedFileTypes={column.allowedFileTypes}
          key={index}
          values={p.values}
          error={p.errors[column.label]}
          setFieldValue={p.setFieldValue}
          disabled={p.disabledFields && p.disabledFields[index]}
          touched={p.touched[column.label]}
          setFileToUpload={p.status.setFileToUpload}
          setFileAsUploaded={p.status.setFileAsUploaded}
          label={
            <span>
              {column.label}&nbsp;
              <Tooltip title={addPeriod(column.description)}>
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        />
      ))}
  </Form>
)

const SubmissionForm: React.ComponentType<any> = withFormik({
  mapPropsToValues: ({ columns, initialValues }) =>
    columns.reduce(
      (acc: any, curr: any, i: number) => ({
        ...acc,
        [curr.label]: initialValues
          ? initialValues[i]
          : // @ts-ignore
            typeDefaultValues[curr.type]
      }),
      {}
    ),
  handleSubmit: (values, { props, resetForm }) => {
    props.postSubmit(values, props.columns, resetForm)
  },
  mapPropsToStatus: (props: any) => ({
    setFileToUpload: props.setFileToUpload,
    setFileAsUploaded: props.setFileAsUploaded
  }),
  validate: async (
    values,
    { columns, deployedWithFactory, deployedWithLightFactory }
  ) => {
    const errors = (
      await Promise.all(
        columns
          .filter(({ type }: any) => type === ItemTypes.GTCR_ADDRESS)
          .map(async ({ label }: any) => ({
            isEmpty: !values[label],
            wasDeployedWithFactory:
              !!values[label] &&
              ((await deployedWithFactory(values[label])) ||
                (await deployedWithLightFactory(values[label]))),
            label: label
          }))
      )
    )
      .filter((res: any) => !res.wasDeployedWithFactory || res.isEmpty)
      .reduce(
        (acc: any, curr: any) => ({
          ...acc,
          [curr.label]: curr.isEmpty
            ? `Enter a list address to proceed.`
            : `This address was not deployed with the list creator.`
        }),
        {}
      )
    if (Object.keys(errors as any).length > 0) throw errors
  }
})(_SubmissionForm as any)

const SubmitModal: React.FC<{
  onCancel: any
  tcrAddress: string
  initialValues: any[]
  submissionDeposit: any
  metaEvidence: {
    metadata: {
      tcrTitle: string
      itemName: string
      columns: any[]
      isTCRofTCRs: boolean
    }
    fileURI: string
  }
  disabledFields: boolean[]
  challengePeriodDuration: any
}> = props => {
  const {
    onCancel,
    initialValues,
    submissionDeposit,
    tcrAddress,
    metaEvidence,
    disabledFields,
    challengePeriodDuration
  } = props
  const nativeCurrency = useNativeCurrency()
  const { pushWeb3Action } = useContext(WalletContext)
  const { setUserSubscribed } = useContext(TourContext)
  const { deployedWithFactory, deployedWithLightFactory } = useFactory()

  const { fileURI, metadata } = metaEvidence || {}
  const { itemName, columns, tcrTitle } = metadata || {}

  // To make sure user cannot press Submit while there are files uploading
  // submit will be blocked until there are no files uploaded
  const [loadingCounter, setLoadingCounter] = useState(0)
  const setFileToUpload = (setUploading: (_: boolean) => void) => {
    setUploading(true)
    setLoadingCounter(loadingCounter + 1)
  }
  const setFileAsUploaded = (setUploading: (_: boolean) => void) => {
    setUploading(false)
    setLoadingCounter(loadingCounter - 1)
  }

  const postSubmit = useCallback(
    (values, columns, resetForm) => {
      pushWeb3Action(
        async ({ account, networkId, library }: any, signer: any) => {
          const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)
          const encodedParams = gtcrEncode({ columns, values })

          // Compute gas cost. We do this because metamask (apparently)
          // has a ceiling gas limit which, if exceeded throws an error.
          const gtcrInterface = new ethers.utils.Interface(_gtcr)
          const data = gtcrInterface.functions.addItem.encode([encodedParams])
          const txObj = {
            to: gtcr.address,
            value: submissionDeposit,
            data
          }
          let gasLimit
          try {
            ;(await library.estimateGas(txObj)).toNumber()
            // eslint-disable-next-line no-unused-vars
          } catch (err) {
            console.warn(
              'Gas estimation failed. Falling back to manual gas limit.'
            )
            gasLimit = 673909
          }

          // Request signature and submit.
          const tx = await gtcr.addItem(encodedParams, {
            value: submissionDeposit,
            gasLimit
          })

          onCancel() // Hide the submission modal.
          resetForm({})

          // Subscribe for notifications
          if (process.env.REACT_APP_NOTIFICATIONS_API_URL && !!networkId) {
            const itemID = ethers.utils.solidityKeccak256(
              ['bytes'],
              [encodedParams]
            )
            fetch(
              `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/subscribe`,
              {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscriberAddr: ethers.utils.getAddress(account),
                  tcrAddr: ethers.utils.getAddress(tcrAddress),
                  itemID,
                  networkID: networkId
                })
              }
            )
              .then(() => setUserSubscribed(true))
              .catch(err => {
                console.error('Failed to subscribe for notifications.', err)
              })
          }
          return {
            tx,
            actionMessage: `Submitting ${(itemName && itemName.toLowerCase()) ||
              'item'}`
          }
        }
      )
    },
    [
      itemName,
      onCancel,
      pushWeb3Action,
      setUserSubscribed,
      submissionDeposit,
      tcrAddress
    ]
  )

  if (!metaEvidence || !submissionDeposit)
    return (
      // @ts-ignore
      <StyledModal
        title="Submit Item"
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>
        ]}
        {...props}
      >
        <StyledSpin />
      </StyledModal>
    )

  return (
    // @ts-ignore
    <StyledModal
      title={`Submit ${(itemName && capitalizeFirstLetter(itemName)) ||
        'Item'}`}
      footer={[
        <Button key="back" onClick={onCancel}>
          Back
        </Button>,
        <Button
          key="challengeSubmit"
          type="primary"
          form={SUBMISSION_FORM_ID}
          htmlType="submit"
          loading={loadingCounter > 0}
        >
          Submit
        </Button>
      ]}
      {...props}
    >
      <StyledParagraph>
        Submit{' '}
        {itemName
          ? `${getArticleFor(itemName)} ${itemName.toLowerCase()}`
          : 'an item'}{' '}
        to {tcrTitle || 'this list'} so other users can find it.
      </StyledParagraph>
      <SubmissionForm
        columns={columns}
        postSubmit={postSubmit}
        initialValues={initialValues}
        disabledFields={disabledFields}
        deployedWithFactory={deployedWithFactory}
        deployedWithLightFactory={deployedWithLightFactory}
        setFileToUpload={setFileToUpload}
        setFileAsUploaded={setFileAsUploaded}
      />
      <Typography.Paragraph>
        Make sure your submission complies with the{' '}
        <a
          href={parseIpfs(fileURI || '')}
          target="_blank"
          rel="noopener noreferrer"
        >
          listing criteria
        </a>{' '}
        to avoid challenges.
      </Typography.Paragraph>
      <StyledAlert
        message={`Note that this is a deposit, not a fee and it will be reimbursed if your submission is accepted. ${challengePeriodDuration &&
          `The challenge period lasts ${humanizeDuration(
            challengePeriodDuration.toNumber() * 1000
          )}`}.`}
        type="info"
        showIcon
      />
      <Descriptions
        bordered
        column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
      >
        <Descriptions.Item
          label={
            <span>
              Total Deposit Required
              <Tooltip title="A deposit is required to submit. This value reimbursed at the end of the challenge period or, if there is a dispute, be awarded to the party that wins.">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          <ETHAmount
            decimals={3}
            amount={submissionDeposit.toString()}
            displayUnit={` ${nativeCurrency}`}
          />
        </Descriptions.Item>
      </Descriptions>
    </StyledModal>
  )
}

export default SubmitModal
